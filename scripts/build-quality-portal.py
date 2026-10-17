"""Build a public, read-only quality index from GitHub Actions metadata."""

import argparse
import html
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "VERA-FEMSA/VERA")
API = os.environ.get("GITHUB_API_URL", "https://api.github.com").rstrip("/")
TOKEN = os.environ.get("GITHUB_TOKEN", "")
WORKFLOWS = (
    ("Calidad de software", "quality.yml", "Backend, cobertura, lint, build y dependencias"),
    ("Interfaz y accesibilidad", "e2e.yml", "Chrome, Edge, Firefox y perfiles móvil/tableta"),
    ("Análisis estático", "codeql.yml", "CodeQL para JavaScript y TypeScript"),
    ("Informe integral", "classroom-quality.yml", "Resumen ejecutivo, logs y artefactos"),
    ("Evaluación de IA", "ai-evaluation.yml", "Casos sintéticos; sin llamadas al modelo"),
)


def escape(value):
    return html.escape(str(value), quote=True)


def request_json(path):
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "VERA-quality-portal/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    try:
        with urlopen(Request(f"{API}{path}", headers=headers), timeout=20) as response:
            return json.load(response)
    except (HTTPError, URLError, TimeoutError, ValueError) as error:
        print(f"GitHub API unavailable for {path}: {type(error).__name__}")
        return None


def parse_date(value):
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        return None


def date_label(value):
    parsed = parse_date(value)
    return parsed.astimezone(timezone.utc).strftime("%d %b %Y · %H:%M UTC") if parsed else "No disponible"


def duration_label(run):
    start = parse_date(run.get("run_started_at"))
    end = parse_date(run.get("updated_at")) if run.get("status") == "completed" else None
    if not start or not end or end < start:
        return "No disponible"
    seconds = int((end - start).total_seconds())
    return f"{seconds // 60} min {seconds % 60} s" if seconds >= 60 else f"{seconds} s"


def latest_run(filename):
    data = request_json(
        f"/repos/{REPOSITORY}/actions/workflows/{filename}/runs?branch=main&per_page=1"
    )
    runs = data.get("workflow_runs", []) if isinstance(data, dict) else []
    return runs[0] if runs else None


def run_state(run, main_sha):
    if not run:
        return ("Sin corrida", "unknown")
    if run.get("status") != "completed":
        return ("En curso", "pending")
    if run.get("head_sha") != main_sha:
        return ("Histórica", "old")
    if run.get("conclusion") == "success":
        return ("Aprobada", "success")
    return ("Revisar fallo", "failure")


def render(output_dir):
    commit = request_json(f"/repos/{REPOSITORY}/commits/main")
    main_sha = commit.get("sha", "") if isinstance(commit, dict) else ""
    if not main_sha:
        raise RuntimeError("No se pudo identificar el commit actual de main; no se publicará un estado ambiguo.")

    rows = []
    core_passed = 0
    for title, filename, scope in WORKFLOWS:
        run = latest_run(filename)
        label, css_class = run_state(run, main_sha)
        if filename in ("quality.yml", "e2e.yml", "codeql.yml") and css_class == "success":
            core_passed += 1
        workflow_url = f"https://github.com/{REPOSITORY}/actions/workflows/{filename}"
        run_url = run.get("html_url", workflow_url) if run else workflow_url
        sha = run.get("head_sha", "") if run else ""
        revision = escape(sha[:8]) if sha else "—"
        rows.append(
            f'<tr><td><strong>{escape(title)}</strong><small>{escape(scope)}</small></td>'
            f'<td><span class="pill {css_class}">{escape(label)}</span></td>'
            f'<td><code>{revision}</code></td>'
            f'<td>{escape(date_label(run.get("created_at") if run else None))}</td>'
            f'<td>{escape(duration_label(run)) if run else "—"}</td>'
            f'<td><a href="{escape(run_url)}">Abrir evidencia ↗</a></td></tr>'
        )

    generated = datetime.now(timezone.utc).strftime("%d %b %Y · %H:%M UTC")
    classroom_url = f"https://github.com/{REPOSITORY}/actions/workflows/classroom-quality.yml"
    commit_url = f"https://github.com/{REPOSITORY}/commit/{main_sha}"
    status = "Tres verificaciones vigentes aprobadas" if core_passed == 3 else f"{core_passed} de 3 verificaciones vigentes aprobadas"
    page = f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>VERA · Evidencia de calidad</title>
  <style>
    :root {{ color-scheme: light; --navy:#0b2343; --ink:#17283d; --green:#0b765f; --line:#dce5e8; --muted:#536579; --paper:#f4f7f8; }}
    * {{ box-sizing:border-box }} body {{ margin:0; background:var(--paper); color:var(--ink); font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif }}
    a {{ color:#075b85; text-underline-offset:3px }} a:focus-visible {{ outline:3px solid #1eb58d; outline-offset:3px }}
    header {{ background:linear-gradient(125deg,#081a35 0%,#14375b 72%,#0b765f 100%); color:white; padding:3.2rem max(1.2rem,calc((100vw - 1120px)/2)) 3.7rem }}
    header img {{ width:56px; height:56px; object-fit:contain; background:white; border-radius:12px; padding:7px }}
    .eyebrow {{ color:#9ee9cc; font-size:.78rem; font-weight:800; letter-spacing:.2em; text-transform:uppercase }}
    h1 {{ font-size:clamp(2rem,5vw,3.6rem); line-height:1.08; margin:.7rem 0 }} h2 {{ font-size:1.45rem; margin:0 0 1rem }}
    header p {{ max-width:750px; color:#dbe8ef }} header a {{ color:white }}
    main {{ max-width:1120px; margin:-1.6rem auto 4rem; padding:0 1.2rem }}
    .panel {{ background:white; border:1px solid var(--line); border-radius:20px; padding:1.5rem; box-shadow:0 12px 32px #0b234312; margin-bottom:1.2rem }}
    .summary {{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1rem }} .metric {{ border-left:3px solid var(--green); padding-left:1rem }}
    .metric b {{ display:block; font-size:1.05rem }} .metric span,small {{ display:block; color:var(--muted); font-size:.87rem }}
    .table-wrap {{ overflow-x:auto }} table {{ width:100%; border-collapse:collapse; min-width:800px }} th,td {{ padding:.9rem .6rem; text-align:left; border-bottom:1px solid var(--line); vertical-align:top }} th {{ color:var(--muted); font-size:.78rem; text-transform:uppercase; letter-spacing:.08em }} td small {{ margin-top:.2rem }}
    .pill {{ display:inline-block; white-space:nowrap; border-radius:999px; padding:.2rem .6rem; font-size:.84rem; font-weight:700 }}
    .success {{ background:#e3f5ec; color:#086441 }} .failure {{ background:#fbe9e8; color:#a12e27 }} .pending {{ background:#e7f0fb; color:#254e82 }} .old,.unknown {{ background:#f3efe1; color:#70521b }}
    .links {{ display:flex; flex-wrap:wrap; gap:.7rem }} .links a {{ display:inline-block; border:1px solid var(--line); padding:.5rem .8rem; border-radius:9px; text-decoration:none; font-weight:650 }}
    .note {{ border-left:4px solid #c29a3b; padding-left:1rem }} footer {{ max-width:1120px; margin:2rem auto; padding:0 1.2rem; color:var(--muted); font-size:.85rem }}
    @media (max-width:700px) {{ .summary {{ grid-template-columns:1fr }} header {{ padding-top:2rem }} }}
  </style>
</head>
<body>
  <header><img src="vera-mark.svg" alt="Marca VERA"><div class="eyebrow">Evidencia verificable · proyecto académico</div>
  <h1>Calidad de VERA, en una sola vista.</h1>
  <p>Resultados publicados por GitHub Actions. Cada fila abre la corrida, sus logs y sus artefactos; la fecha y el commit evitan confundir una evidencia histórica con el estado actual.</p></header>
  <main>
    <section class="panel summary" aria-label="Resumen de calidad">
      <div class="metric"><span>CI vigente de main</span><b>{escape(status)}</b><span>Calidad, interfaz y CodeQL</span></div>
      <div class="metric"><span>Commit observado</span><b><a href="{escape(commit_url)}"><code>{escape(main_sha[:12])}</code></a></b><span>Rama main</span></div>
      <div class="metric"><span>Actualizado</span><b>{escape(generated)}</b><span>Generado automáticamente, sin modelo de IA</span></div>
    </section>
    <section class="panel"><h2>Corridas y tiempos</h2><div class="table-wrap"><table>
      <thead><tr><th>Verificación</th><th>Estado</th><th>SHA probado</th><th>Fecha</th><th>Duración</th><th>Detalle</th></tr></thead>
      <tbody>{''.join(rows)}</tbody></table></div></section>
    <section class="panel"><h2>Para revisar en dos minutos</h2><div class="links">
      <a href="{escape(classroom_url)}">Informe integral y Summary ↗</a>
      <a href="https://github.com/{escape(REPOSITORY)}/blob/main/docs/testing/professor-quick-run.md">Guía docente ↗</a>
      <a href="https://github.com/{escape(REPOSITORY)}/blob/main/docs/testing/test-plan.md">Plan de 78 casos ↗</a>
      <a href="https://github.com/{escape(REPOSITORY)}/blob/main/docs/hu-acceptance-audit.md">Estado por HU ↗</a>
      <a href="https://github.com/{escape(REPOSITORY)}/wiki">Wiki ↗</a>
    </div></section>
    <section class="panel note"><h2>Cómo interpretar el resultado</h2>
      <p>Una corrida aprobada verifica únicamente sus pruebas en el SHA indicado. Los E2E utilizan fixtures de API; no demuestran persistencia ni autenticación en el despliegue. El flujo integral contiene recuentos de pruebas, cobertura y artefactos durante su periodo de retención. Las pruebas de carga de 150/250 usuarios requieren staging autorizado y no se ejecutan en esta página.</p>
      <p>Los resultados de seguridad requieren revisar también <a href="https://github.com/{escape(REPOSITORY)}/security">Security</a>: un check CodeQL verde no significa cero alertas. Un despliegue exitoso tampoco acredita por sí solo la aceptación de cada HU.</p>
    </section>
  </main><footer>VERA · Fuente: API de GitHub Actions y commit de main. Este sitio no usa datos personales, secretos ni servicios de IA.</footer>
</body></html>"""
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "index.html").write_text(page, encoding="utf-8", newline="\n")
    shutil.copyfile(ROOT / "frontend" / "public" / "vera-logo.svg", output_dir / "vera-mark.svg")
    print(f"Quality portal generated for {main_sha[:12]} with {core_passed}/3 current checks.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    render(parser.parse_args().output_dir)
