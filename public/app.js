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

function setLoading() {
  response.dataset.state = 'loading';
  response.textContent = 'Menyiapkan data…';
}

function render(data, url) {
  requestUrl.textContent = url.replace('./', '/');
  response.dataset.state = 'ready';
  response.textContent = JSON.stringify(data, null, 2);
}

function renderError(error) {
  response.dataset.state = 'error';
  response.textContent = `Gagal memuat data. ${error.message}`;
}

function fill(select, items, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>` + items
    .map(item => `<option value="${item.code}">${item.name}${item.type ? ` · ${item.type}` : ''}</option>`)
    .join('');
  select.disabled = false;
}

async function loadProvinces() {
  setLoading();
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
    renderError(error);
  }
}

async function loadChildren(child, path, placeholder) {
  child.disabled = true;
  setLoading();
  try {
    const data = await get(path);
    fill(child, data.data, placeholder);
    render(data, path);
  } catch (error) {
    renderError(error);
  }
}

province.addEventListener('change', () => {
  regency.innerHTML = '<option value="">Pilih kabupaten/kota</option>';
  district.innerHTML = '<option value="">Pilih kecamatan</option>';
  regency.disabled = true;
  district.disabled = true;
  if (!province.value) return loadProvinces();
  loadChildren(regency, `${API}/regencies/${province.value}.json`, 'Pilih kabupaten/kota');
});

regency.addEventListener('change', () => {
  district.innerHTML = '<option value="">Pilih kecamatan</option>';
  district.disabled = true;
  if (!regency.value) return;
  loadChildren(district, `${API}/districts/${regency.value}.json`, 'Pilih kecamatan');
});

district.addEventListener('change', async () => {
  if (!district.value) return;
  const url = `${API}/villages/${district.value}.json`;
  setLoading();
  try {
    render(await get(url), url);
  } catch (error) {
    render({
      data: [],
      meta: { count: 0, api_version: 'v1', parent_code: district.value },
      note: 'Belum ada sample villages pada repository.',
    }, url);
  }
});

async function copyText(button) {
  const text = $(button.dataset.copy).textContent.replace(/^GET\s+/, '');
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const fallback = document.createElement('textarea');
    fallback.value = text;
    document.body.append(fallback);
    fallback.select();
    document.execCommand('copy');
    fallback.remove();
  }
  const original = button.textContent;
  button.textContent = 'Copied';
  window.setTimeout(() => { button.textContent = original; }, 1200);
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-copy]');
  if (button) copyText(button);
});

$('[data-dismiss-announcement]').addEventListener('click', event => {
  event.currentTarget.closest('.announcement').remove();
});

loadProvinces();
