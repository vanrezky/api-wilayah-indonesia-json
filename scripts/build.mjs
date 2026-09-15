import { readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = resolve(ROOT, 'data/raw');
const API = resolve(ROOT, 'public/api/v1');
const VALIDATE_ONLY = process.argv.includes('--validate-only');

const sourceFiles = {
  provinces: 'provinces.json',
  regencies: 'districts.json',
  districts: 'sub_districts.json',
  villages: 'villages.json',
};

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function asCode(value) {
  return nullable(value);
}

function nullable(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return !text || text === '0' ? null : text;
}

function externalCodes(item) {
  const rajaongkir = nullable(item.rajaongkir);
  return rajaongkir ? { rajaongkir } : {};
}

function indexBy(items, key, label) {
  const index = new Map();
  for (const item of items) {
    const value = item[key];
    assert(value !== undefined && value !== null, `${label}: missing ${key}`);
    assert(!index.has(value), `${label}: duplicate ${key}=${value}`);
    index.set(value, item);
  }
  return index;
}

function assertUniqueCodes(items, label) {
  const seen = new Set();
  for (const item of items) {
    const code = asCode(item.apicoid_code, `${label} id=${item.id}`);
    if (code === null) continue;
    assert(!seen.has(code), `${label}: duplicate code=${code}`);
    seen.add(code);
  }
}

function sortByName(items) {
  return items.sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));
}

function maxUpdatedAt(collections) {
  const values = collections.flatMap(items => items.map(item => item.updated_at).filter(Boolean));
  if (!values.length) return null;
  return values.sort().at(-1);
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function response(data, extraMeta = {}) {
  return {
    data,
    meta: {
      count: Array.isArray(data) ? data.length : data ? 1 : 0,
      api_version: 'v1',
      ...extraMeta,
    },
  };
}

const raw = Object.fromEntries(
  await Promise.all(
    Object.entries(sourceFiles).map(async ([key, filename]) => [key, await readJson(resolve(RAW, filename))]),
  ),
);

for (const [label, items] of Object.entries(raw)) {
  assert(Array.isArray(items), `${sourceFiles[label]} must contain a JSON array`);
  raw[label] = items.filter(item => asCode(item.apicoid_code) !== null);
  indexBy(raw[label], 'id', label);
  assertUniqueCodes(raw[label], label);
}

const provinceById = indexBy(raw.provinces, 'id', 'provinces');
const regencyById = indexBy(raw.regencies, 'id', 'regencies');
const districtById = indexBy(raw.districts, 'id', 'districts');

const provinces = sortByName(raw.provinces.map(item => ({
  id: item.id,
  code: asCode(item.apicoid_code, `province id=${item.id}`),
  name: item.name,
  external_codes: externalCodes(item),
})));

const regencies = sortByName(raw.regencies.map(item => {
  const parent = provinceById.get(item.province_id);
  assert(parent, `regency id=${item.id}: province_id=${item.province_id} not found`);
  return {
    id: item.id,
    code: asCode(item.apicoid_code, `regency id=${item.id}`),
    province_code: asCode(parent.apicoid_code, `province id=${parent.id}`),
    type: item.type,
    name: item.name,
    postal_code: nullable(item.postal_code),
    external_codes: externalCodes(item),
  };
}));

const districts = sortByName(raw.districts.map(item => {
  const parent = regencyById.get(item.district_id);
  assert(parent, `district id=${item.id}: district_id=${item.district_id} not found`);
  return {
    id: item.id,
    code: asCode(item.apicoid_code, `district id=${item.id}`),
    regency_code: asCode(parent.apicoid_code, `regency id=${parent.id}`),
    name: item.name,
    postal_code: nullable(item.postal_code),
    external_codes: externalCodes(item),
  };
}));

const villages = sortByName(raw.villages.map(item => {
  const parent = districtById.get(item.sub_district_id);
  assert(parent, `village id=${item.id}: sub_district_id=${item.sub_district_id} not found`);
  return {
    id: item.id,
    code: asCode(item.apicoid_code, `village id=${item.id}`),
    district_code: asCode(parent.apicoid_code, `district id=${parent.id}`),
    name: item.name,
    postal_code: nullable(item.postal_code),
    external_codes: externalCodes(item),
  };
}));

console.log(`✓ provinces: ${provinces.length}`);
console.log(`✓ regencies: ${regencies.length}`);
console.log(`✓ districts: ${districts.length}`);
console.log(`✓ villages: ${villages.length}`);
console.log('✓ relationships and codes are valid');

if (VALIDATE_ONLY) process.exit(0);

await rm(API, { recursive: true, force: true });

await writeJson(resolve(API, 'meta.json'), {
  api_version: 'v1',
  dataset_updated_at: maxUpdatedAt(Object.values(raw)),
  counts: {
    provinces: provinces.length,
    regencies: regencies.length,
    districts: districts.length,
    villages: villages.length,
  },
  terminology: {
    provinces: 'Provinsi',
    regencies: 'Kabupaten/Kota',
    districts: 'Kecamatan',
    villages: 'Desa/Kelurahan',
  },
});

await writeJson(resolve(API, 'provinces.json'), response(provinces));
await writeJson(resolve(API, 'data/provinces.json'), response(provinces));
await writeJson(resolve(API, 'data/regencies.json'), response(regencies));
await writeJson(resolve(API, 'data/districts.json'), response(districts));
await writeJson(resolve(API, 'data/villages.json'), response(villages));

async function writeGrouped(items, parentKey, directory) {
  const groups = new Map();
  for (const item of items) {
    const parentCode = item[parentKey];
    if (!groups.has(parentCode)) groups.set(parentCode, []);
    groups.get(parentCode).push(item);
  }
  for (const [parentCode, children] of groups) {
    await writeJson(
      resolve(API, directory, `${parentCode}.json`),
      response(sortByName(children), { parent_code: parentCode }),
    );
  }
}

await writeGrouped(regencies, 'province_code', 'regencies');
await writeGrouped(districts, 'regency_code', 'districts');
await writeGrouped(villages, 'district_code', 'villages');

console.log(`✓ static API written to ${API}`);
