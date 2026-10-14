// Quest graphics: scene resolution is independent of the readable CSS interface.
export const PRESETS = {
 '8k': { label: 'Ultra 8K', width: 7680, height: 4320 },
 '4k': { label: 'Alta 4K', width: 3840, height: 2160 },
 high: { label: 'Alta — 150%', scale: 1.5 },
 light: { label: 'Leve — 100%', scale: 1 }
};
const mobile = () => navigator.maxTouchPoints > 0 || /Mobi|Android|iPad|iPhone/i.test(navigator.userAgent);
export function renderSize({width, height, dpr = 1, preset = '8k', limit = 8192, viewport = [limit, limit], mobile = false, adaptiveScale = 1}) {
 width = Math.max(1, Number(width) || 1); height = Math.max(1, Number(height) || 1);
 const profile = PRESETS[preset] || PRESETS.high;
 const requested = profile.width ? Math.min(profile.width / width, profile.height / height) : profile.scale * Math.max(1, Number(dpr) || 1);
 const budget = mobile ? 2073600 : 33177600;
 const scale = Math.min(requested * adaptiveScale, limit / width, limit / height, viewport[0] / width, viewport[1] / height, Math.sqrt(budget / (width * height)));
 return {width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale))};
}
const extensions = new WeakMap();
export function filterTexture(gl, mipmaps = true, atlas = false) {
 gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
 if (mipmaps) {
  gl.generateMipmap(gl.TEXTURE_2D);
  // The native ground atlas has a one-pixel gutter. Limit mip levels to avoid
  // mixing distant materials across tiles; model textures use the full chain.
  if (atlas && gl.TEXTURE_MAX_LEVEL !== undefined) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 3);
 }
 if (!extensions.has(gl)) extensions.set(gl, gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic') || gl.getExtension('MOZ_EXT_texture_filter_anisotropic'));
 const ext = extensions.get(gl);
 if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
}
let preset, automatic = true, adaptiveScale = 1, renderer, panel, resolution, checkbox, selector, sampleStart = 0, frames = 0, graceUntil = 0;
const key = 'quest.graphics.v1';
function preferences() {
 if (preset) return;
 preset = mobile() ? 'light' : 'high';
 try { const saved = JSON.parse(localStorage.getItem(key)); if (saved && PRESETS[saved.preset]) { preset = saved.preset; automatic = saved.automatic !== false; } } catch {}
}
function save() { try { localStorage.setItem(key, JSON.stringify({preset, automatic})); } catch {} }
function reset() { adaptiveScale = 1; sampleStart = 0; frames = 0; graceUntil = performance.now() + 10000; }
function refresh() {
 if (!resolution || !renderer.gl) return;
 const gl = renderer.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
 resolution.textContent = `Resolução em uso: ${w} × ${h}${adaptiveScale < 1 ? ' · ajustada para fluidez' : ''}`;
 renderer.canvas.dataset.questResolution = `${w}x${h}`;
 renderer.canvas.dataset.questGraphics = preset;
}
function mount() {
 if (panel) { panel.hidden = false; return; }
 panel = document.createElement('div'); panel.id = 'quest-graphics';
 panel.style.cssText = 'position:fixed;right:12px;top:42px;z-index:9999;font:13px Arial;color:#eee7d8;pointer-events:auto';
 const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Gráficos'; button.setAttribute('aria-expanded','false');
 button.style.cssText = 'padding:7px 12px;background:#182b25e8;color:#eee7d8;border:1px solid #b4a071;border-radius:5px;cursor:pointer';
 const body = document.createElement('div'); body.hidden = true;
 body.style.cssText = 'margin-top:6px;padding:12px;max-width:310px;background:#14241ff5;border:1px solid #b4a071;border-radius:6px;box-shadow:0 4px 18px #0008';
 const label = document.createElement('label'); label.textContent = 'Qualidade gráfica '; label.htmlFor = 'quest-graphics-preset';
 selector = document.createElement('select'); selector.id = 'quest-graphics-preset'; selector.style.cssText = 'display:block;width:100%;margin:7px 0;padding:6px';
 for (const [value, profile] of Object.entries(PRESETS)) { const option = document.createElement('option'); option.value = value; option.textContent = profile.label; selector.appendChild(option); }
 selector.value = preset;
 selector.onchange = () => { preset = selector.value; reset(); save(); renderer.resize(); };
 resolution = document.createElement('p'); resolution.style.cssText = 'line-height:1.5;margin:9px 0'; resolution.setAttribute('role','status');
 const autoLabel = document.createElement('label'); autoLabel.style.cssText = 'display:block;line-height:1.5';
 checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = automatic;
 checkbox.onchange = () => { automatic = checkbox.checked; reset(); save(); renderer.resize(); };
 autoLabel.append(checkbox, document.createTextNode(' Ajustar para manter fluidez'));
 const note = document.createElement('p'); note.textContent = '8K renderiza o cenário em alta resolução e suaviza as bordas. A resolução final depende da sua placa gráfica e do formato da janela.'; note.style.cssText = 'font-size:12px;line-height:1.5;opacity:.85;margin-bottom:0';
 body.append(label, selector, resolution, autoLabel, note); panel.append(button, body);
 button.onclick = () => { body.hidden = !body.hidden; button.setAttribute('aria-expanded', String(!body.hidden)); refresh(); };
 for (const event of ['mousedown','mouseup','click','wheel','touchstart','keydown']) panel.addEventListener(event, e => e.stopPropagation());
 document.body.appendChild(panel);
}
export default {
 active: false,
 attach(current) { preferences(); renderer = current; this.active = true; reset(); mount(); current.resize(); },
 detach() { this.active = false; if (panel) panel.hidden = true; sampleStart = 0; },
 size(gl, width, height, dpr) {
  preferences();
  const limit = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), gl.getParameter(gl.MAX_TEXTURE_SIZE));
  return renderSize({width, height, dpr, preset: this.active ? preset : 'high', limit, viewport: gl.getParameter(gl.MAX_VIEWPORT_DIMS), mobile: mobile(), adaptiveScale: this.active ? adaptiveScale : 1});
 },
 resized() { refresh(); },
 frame(current, now) {
  if (!this.active || !automatic || document.hidden || now < graceUntil) { sampleStart = 0; frames = 0; return; }
  if (!sampleStart) sampleStart = now;
  frames++;
  const elapsed = now - sampleStart;
  if (elapsed < 4000) return;
  const fps = frames * 1000 / elapsed;
  sampleStart = now; frames = 0;
  if (fps < Math.min(24, (current.frameLimit || 60) * .75) && adaptiveScale > .26) {
   adaptiveScale = Math.max(.25, adaptiveScale * .75); graceUntil = now + 5000; current.resize();
  }
 },
 recover() { adaptiveScale = Math.min(adaptiveScale, .5); sampleStart = 0; }
};
