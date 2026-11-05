"""Bundle the app into one self-contained page (gfc-crm.html) for publishing as an Artifact."""
import base64
read = lambda p: open(p, encoding='utf-8').read()
logo = 'data:image/png;base64,' + base64.b64encode(open('gfc-logo.png', 'rb').read()).decode()
js = [read(p) for p in ('db.js', 'import.js', 'app.js')]
assert not any('</script' in j.lower() for j in js)
html = f'''<title>GFC CRM</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
{read('styles.css')}
</style>
<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
<div class="app">
  <div class="frame">
    <aside class="sidebar" id="sidebar"></aside>
    <main class="main" id="main"></main>
  </div>
</div>
<div id="toasts" aria-live="polite"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<script>window.GFC_LOGO = "{logo}";</script>
''' + ''.join(f'<script>\n{j}\n</script>\n' for j in js)
open('gfc-crm.html', 'w', encoding='utf-8').write(html)
print(len(html), 'bytes')
