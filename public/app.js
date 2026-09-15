const $ = selector => document.querySelector(selector);
const API = './api/v1';

const province = $('#province');
const regency = $('#regency');
const district = $('#district');
const response = $('#response');
const requestUrl = $('#request-url');

async function get(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function render(data, url) {
  requestUrl.textContent = `GET ${url.replace('./', '/')}`;
  response.textContent = JSON.stringify(data, null, 2);
}

function fill(select, items, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>` + items
    .map(item => `<option value="${item.code}">${item.name}${item.type ? ` · ${item.type}` : ''}</option>`)
    .join('');
  select.disabled = false;
}

async function loadProvinces() {
  try {
    const [meta, data] = await Promise.all([
      get(`${API}/meta.json`),
      get(`${API}/provinces.json`),
    ]);
    fill(province, data.data, 'Pilih provinsi');
    render(data, `${API}/provinces.json`);
    $('#stats').innerHTML = Object.entries(meta.counts)
      .map(([label, value]) => `<span><strong>${value.toLocaleString('id-ID')}</strong>${label}</span>`)
      .join('');
  } catch (error) {
    response.textContent = `Gagal memuat API: ${error.message}`;
  }
}

province.addEventListener('change', async () => {
  regency.disabled = true;
  district.disabled = true;
  regency.innerHTML = '<option value="">Pilih kabupaten/kota</option>';
  district.innerHTML = '<option value="">Pilih kecamatan</option>';
  if (!province.value) return loadProvinces();
  const url = `${API}/regencies/${province.value}.json`;
  const data = await get(url);
  fill(regency, data.data, 'Pilih kabupaten/kota');
  render(data, url);
});

regency.addEventListener('change', async () => {
  district.disabled = true;
  district.innerHTML = '<option value="">Pilih kecamatan</option>';
  if (!regency.value) return;
  const url = `${API}/districts/${regency.value}.json`;
  const data = await get(url);
  fill(district, data.data, 'Pilih kecamatan');
  render(data, url);
});

district.addEventListener('change', async () => {
  if (!district.value) return;
  const url = `${API}/villages/${district.value}.json`;
  try {
    render(await get(url), url);
  } catch (error) {
    render({ data: [], meta: { count: 0, api_version: 'v1', parent_code: district.value }, note: 'Belum ada sample villages pada repository.' }, url);
  }
});

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-copy]');
  if (!button) return;
  const text = $(button.dataset.copy).textContent.replace(/^GET\s+/, '');
  await navigator.clipboard.writeText(text);
  const original = button.textContent;
  button.textContent = 'Copied';
  setTimeout(() => button.textContent = original, 1200);
});

loadProvinces();
