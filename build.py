"""Build the original weave, plain-text views and a self-contained local preview.

Uses Python 3 and Node.js built-ins. The approved flowing brand artwork is embedded unchanged.
Run from any directory: python3 /absolute/path/to/wovon-site/build.py
"""
from pathlib import Path
from html.parser import HTMLParser
import base64
import html
import json
import mimetypes
import subprocess
import re
import shutil

ROOT = Path(__file__).resolve().parent


def weave():
    """Record the live renderer as an SVG; keep one geometry implementation."""
    result=subprocess.run(['node',str(ROOT/'render-weave.cjs')],check=True,capture_output=True,text=True)
    return result.stdout


class ReadableHTML(HTMLParser):
    """Derive the text representation from the shipped semantic HTML."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.main = False
        self.skip = 0
        self.out = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'main': self.main = True
        if not self.main: return
        voids = ('img', 'br', 'hr', 'input', 'link', 'meta', 'source')
        if self.skip:
            if tag not in voids: self.skip += 1
            return
        if tag in ('svg', 'script', 'style') or attrs.get('aria-hidden') == 'true' or 'hidden' in attrs:
            if tag not in voids: self.skip = 1
            return
        if tag in ('h1', 'h2', 'h3'): self.out.append('\n\n' + '#'*int(tag[1]) + ' ')
        elif tag in ('section', 'article', 'p', 'summary', 'figcaption', 'details', 'button', 'label'): self.out.append('\n\n')
        elif tag == 'li': self.out.append('\n- ')
        elif tag in ('br', 'span', 'strong', 'small'): self.out.append(' ')
        if tag == 'a' and 'href' in attrs:
            self.out.append('[')
            self.link = 'index.html'+attrs['href'] if attrs['href'].startswith('#') else attrs['href']
    def handle_endtag(self, tag):
        if self.skip:
            self.skip -= 1
            return
        if self.skip or not self.main: return
        if tag == 'a': self.out.append(f']({getattr(self,"link", "")}) ')
        if tag in ('span', 'strong', 'small'): self.out.append(' ')
        if tag == 'div': self.out.append('\n')
        if tag in ('p', 'h1', 'h2', 'h3', 'button', 'summary', 'li', 'label'): self.out.append('\n')
        if tag == 'main': self.main = False
    def handle_data(self, value):
        if self.main and not self.skip:
            self.out.append(re.sub(r'\s+', ' ', value))
    def text(self):
        value = ''.join(self.out)
        value = re.sub(r'[ \t]*\n[ \t]*', '\n', value)
        value = re.sub(r'[ \t]{2,}', ' ', value)
        return re.sub(r'\n{3,}', '\n\n', value).strip()+'\n'


def data_uri(file):
    mime=mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
    return f'data:{mime};base64,'+base64.b64encode(file.read_bytes()).decode()


def main():
    # The brand kit remains the source of truth; these are deployable copies.
    brand = ROOT.parent/'wovon-brand'/'assets'
    for item in ['logos/wovon-wordmark-ink.svg', 'logos/wovon-wordmark-white.svg',
                 'marks/wovon-w-ink.svg', 'patterns/flowing-weave-light.png',
                 'patterns/weave-grid-light-tile.svg', 'fonts/Manrope-Variable.ttf',
                 'fonts/IBMPlexMono-Regular.ttf', 'fonts/Manrope-OFL.txt',
                 'fonts/IBMPlexMono-OFL.txt']:
        source=brand/item
        target=ROOT/'assets'/Path(item).name
        if source.is_file(): shutil.copy2(source,target)
        elif not target.is_file(): raise FileNotFoundError(f'Missing approved brand asset: {target}')
    page=(ROOT/'index.html').read_text()
    graphic='<!-- WEAVE_START -->\n'+weave()+'\n<!-- WEAVE_END -->'
    if '<!-- WEAVE_GRAPHIC -->' in page: page=page.replace('<!-- WEAVE_GRAPHIC -->',graphic)
    else: page=re.sub(r'<!-- WEAVE_START -->.*?<!-- WEAVE_END -->',lambda _:graphic,page,flags=re.S)
    description=html.unescape(re.search(r'<meta name="description" content="([^"]+)"',page).group(1))
    product={'@context':'https://schema.org','@type':'SoftwareApplication','name':'Wovon','applicationCategory':'BusinessApplication','description':description}
    schema='<!-- SCHEMA_START -->\n<script type="application/ld+json">'+json.dumps(product,ensure_ascii=False)+'</script>\n<!-- SCHEMA_END -->'
    if '<!-- STRUCTURED_DATA -->' in page: page=page.replace('<!-- STRUCTURED_DATA -->',schema)
    else: page=re.sub(r'<!-- SCHEMA_START -->.*?<!-- SCHEMA_END -->',lambda _:schema,page,flags=re.S)
    (ROOT/'index.html').write_text(page)
    (ROOT/'knowledge-model.json').write_text(json.dumps(product,indent=2,ensure_ascii=False)+'\n')
    reader=ReadableHTML();reader.feed(page)
    (ROOT/'content.md').write_text('# Wovon\n\nLocal design preview. The example records and responses are illustrative.\n\n'+reader.text())
    (ROOT/'llms.txt').write_text('# Wovon\n\nA knowledge model for businesses, people and AI agents.\n\n- [Product explanation and illustrative evidence](content.md)\n- [Structured product description](knowledge-model.json)\n- [Interactive website](index.html)\n\nThis is a local design preview. The procurement example is illustrative; its responses are not live Wovon output.\n')
    css=(ROOT/'site.css').read_text()
    css=re.sub(r"url\(['\"]?(assets/[^)'\"]+)['\"]?\)",lambda m:'url("'+data_uri(ROOT/m.group(1))+'")',css)
    bundle=page.replace('<html lang="en">', '<html lang="en" data-preview="true">').replace('<link rel="stylesheet" href="site.css">','<style>'+css+'</style>')
    bundle=bundle.replace('<script src="weave.js" defer></script>','')
    bundle=bundle.replace('<script src="site.js" defer></script>','')
    bundle=bundle.replace('</body>','<script>'+(ROOT/'weave.js').read_text()+'\n'+(ROOT/'site.js').read_text()+'</script>\n</body>')
    bundle=re.sub(r'(src|href)="(assets/[^"]+)"',lambda m:m.group(1)+'="'+data_uri(ROOT/m.group(2))+'"',bundle)
    bundle='\n'.join(line.rstrip() for line in bundle.splitlines())+'\n'
    (ROOT/'preview.html').write_text(bundle)
    # Publish only this explicit output. Source notes and future private docs stay out.
    dist=ROOT/'dist'
    if dist.exists(): shutil.rmtree(dist)
    dist.mkdir()
    production=page.replace('  <meta name="robots" content="noindex">\n','')
    production=production.replace('<span class="preview-note">Design preview · 2026</span>','')
    production=production.replace('href="docs/index.html"','href="/docs/"')
    production=production.replace('</head>','  <link rel="canonical" href="https://wovon.ai/">\n</head>')
    (dist/'index.html').write_text(production)
    for name in ['site.css','weave.js','site.js','knowledge-model.json']:
        shutil.copy2(ROOT/name,dist/name)
    for name in ['content.md','llms.txt']:
        text=(ROOT/name).read_text().replace('Local design preview. ', '').replace('This is a local design preview. ', '')
        (dist/name).write_text(text)
    (dist/'assets').mkdir()
    for name in ['wovon-wordmark-ink.svg','wovon-wordmark-white.svg','wovon-w-ink.svg',
                 'flowing-weave-light.png','weave-grid-light-tile.svg','Manrope-Variable.ttf',
                 'IBMPlexMono-Regular.ttf','Manrope-OFL.txt','IBMPlexMono-OFL.txt']:
        shutil.copy2(ROOT/'assets'/name,dist/'assets'/name)
    for route in ['docs','thanks']:
        (dist/route).mkdir()
        shutil.copy2(ROOT/route/'index.html',dist/route/'index.html')
    print('Built review files and Netlify dist/ (explicit public-file allowlist).')


if __name__ == '__main__': main()
