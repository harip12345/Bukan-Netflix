/**
 * tmdb-api.js — Klien API TMDB untuk FilmFlix
 * ---------------------------------------------------------------
 * API key TIDAK ditulis di sini. Key dibaca dari environment variable
 * supaya aman di-commit ke GitHub. Lihat .env.example & README-API.md.
 *
 * Sumber key yang didukung (otomatis dipilih sesuai lingkungan):
 *   - Vite / bundler frontend : import.meta.env.VITE_TMDB_API_KEY
 *   - Node / server-side      : process.env.TMDB_API_KEY
 *   - Disuntik saat runtime    : window.__TMDB_API_KEY__
 */

function resolveApiKey() {
  // Vite & bundler modern
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_TMDB_API_KEY) {
      return import.meta.env.VITE_TMDB_API_KEY;
    }
  } catch (_) { /* import.meta tidak tersedia di lingkungan ini */ }

  // Node / proses build
  if (typeof process !== 'undefined' && process.env && process.env.TMDB_API_KEY) {
    return process.env.TMDB_API_KEY;
  }

  // Disuntik manual di runtime (mis. <script>window.__TMDB_API_KEY__='...'</script>)
  if (typeof window !== 'undefined' && window.__TMDB_API_KEY__) {
    return window.__TMDB_API_KEY__;
  }

  return '';
}

export const TMDB_API_KEY = resolveApiKey();
export const BASE = 'https://api.themoviedb.org/3';
export const IMG  = 'https://image.tmdb.org/t/p';
export const LANG = 'id-ID';

if (!TMDB_API_KEY) {
  console.warn('[tmdb-api] TMDB_API_KEY kosong. Set VITE_TMDB_API_KEY di file .env Anda.');
}

/* ── Filter konten India ─────────────────────────────────────── */
const BLOCK_LANGS = ['hi', 'ta', 'te', 'ml', 'kn', 'bn', 'mr', 'pa', 'gu', 'or', 'as'];

export function excludeIndian(list = []) {
  return list.filter(m => {
    const lang = (m.original_language || '').toLowerCase();
    if (BLOCK_LANGS.includes(lang)) return false;
    const countries = m.origin_country
      || (m.production_countries ? m.production_countries.map(c => c.iso_3166_1) : []);
    if (Array.isArray(countries) && countries.includes('IN')) return false;
    return true;
  });
}

/* ── Helper fetch ────────────────────────────────────────────── */
async function tmdb(endpoint, params = {}) {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY tidak ditemukan. Set environment variable VITE_TMDB_API_KEY / TMDB_API_KEY.');
  }
  const url = new URL(`${BASE}${endpoint}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('language', LANG);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDb ${res.status}`);
  return res.json();
}

/* ── Endpoint katalog (sudah otomatis tanpa film India) ──────── */
export async function getPopular(page = 1)    { const d = await tmdb('/movie/popular',     { page }); return excludeIndian(d.results); }
export async function getTopRated(page = 1)   { const d = await tmdb('/movie/top_rated',   { page }); return excludeIndian(d.results); }
export async function getNowPlaying(page = 1) { const d = await tmdb('/movie/now_playing', { page }); return excludeIndian(d.results); }
export async function getTrending(window = 'week') { const d = await tmdb(`/trending/movie/${window}`); return excludeIndian(d.results); }

export async function searchMovies(query, page = 1) {
  if (!query || !query.trim()) return [];
  const d = await tmdb('/search/movie', { query, page, include_adult: false });
  return excludeIndian(d.results);
}

export async function getMovieDetail(id) {
  return tmdb(`/movie/${id}`, { append_to_response: 'videos,credits' });
}

export async function verifyKey() {
  try {
    const res = await fetch(`${BASE}/configuration?api_key=${TMDB_API_KEY}`);
    return res.ok;
  } catch { return false; }
}

/* ── Helper URL gambar ───────────────────────────────────────── */
export function posterUrl(path, size = 'w342')   { return path ? `${IMG}/${size}${path}` : ''; }
export function backdropUrl(path, size = 'w1280') { return path ? `${IMG}/${size}${path}` : ''; }

/* ── Sumber embed pemutar (film & series) ────────────────────── */
export const PROVIDERS = [
  { name: 'VidSrc.to',  movie: id => `https://vidsrc.to/embed/movie/${id}`,           tv: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}` },
  { name: 'VidSrc.cc',  movie: id => `https://vidsrc.cc/v2/embed/movie/${id}`,        tv: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}` },
  { name: 'VidLink',    movie: id => `https://vidlink.pro/movie/${id}`,               tv: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}` },
  { name: 'Embed.su',   movie: id => `https://embed.su/embed/movie/${id}`,            tv: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}` },
  { name: 'AutoEmbed',  movie: id => `https://player.autoembed.cc/embed/movie/${id}`, tv: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}` },
  { name: 'VidFast',    movie: id => `https://vidfast.pro/movie/${id}`,               tv: (id, s, e) => `https://vidfast.pro/tv/${id}/${s}/${e}` },
  { name: '2Embed',     movie: id => `https://www.2embed.cc/embed/${id}`,             tv: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}` },
  { name: 'MoviesAPI',  movie: id => `https://moviesapi.club/movie/${id}`,            tv: (id, s, e) => `https://moviesapi.club/tv/${id}-${s}-${e}` },
  { name: 'MultiEmbed', movie: id => `https://multiembed.mov/?video_id=${id}&tmdb=1`, tv: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}` },
];

export function movieEmbedUrl(id, providerIndex = 0) {
  const p = PROVIDERS[providerIndex] || PROVIDERS[0];
  return p.movie(id);
}
