"""Genera el único ZIP acumulativo de integración, solo desde fuentes y sin secretos."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
output = root / 'IA/Agentes/Milo/Integracion-Milo-Completa.zip'
paths = [
    'Back End/src', 'Back End/tests', 'Back End/package.json', 'Back End/package-lock.json',
    'Back End/tsconfig.json', 'Back End/.env.example', 'Back End/scripts/verificar-gemini.mjs',
    'Front End/src/app/core', 'Front End/src/app/shared',
    'Front End/src/app/features/milo', 'Front End/src/app/features/milo-widget',
    'Front End/src/app/features/admin', 'Front End/src/app/features/curriculums',
    'Front End/src/app/features/dashboard', 'Front End/src/app/features/access',
    'Front End/src/app/features/profile', 'Front End/src/app/app.component.ts',
    'Front End/src/app/app.config.ts', 'Front End/src/app/app.routes.ts',
    'Front End/src/environments', 'Front End/public/assets/milo/Milo.png',
    'Front End/src/styles.css', 'Front End/angular.json', 'Front End/proxy.conf.json',
    'Front End/tsconfig.json', 'Front End/tsconfig.app.json', 'Front End/package.json',
    'Front End/package-lock.json', 'Front End/tests', 'scripts/empaquetar-milo.py',
    'docs/Amplify-api-proxy.regla.json', 'docs/Admin-Cognito-permisos.ejemplo.json'
]
files = {}
for item in paths:
    path = root / item
    if not path.exists():
        raise SystemExit(f'Falta un archivo requerido: {item}')
    for file in sorted(path.rglob('*')) if path.is_dir() else [path]:
        if not file.is_file():
            continue
        relative = file.relative_to(root)
        if file.is_symlink() or not file.resolve().is_relative_to(root):
            raise SystemExit('No se permiten enlaces ni archivos fuera del proyecto.')
        if any(part in ('.git', 'node_modules', 'dist', '.angular', '.aws', '__pycache__') or
               part == '.env' or part.startswith('.env.') and part != '.env.example' or
               part.startswith('.lambda-package.') or part in ('credentials', 'config.json')
               for part in relative.parts):
            raise SystemExit(f'Ruta excluida del paquete: {relative}')
        if file.suffix.lower() in ('.zip', '.log', '.pyc'):
            raise SystemExit(f'No se permiten paquetes anidados ni temporales: {relative}')
        files[relative.as_posix()] = file

manifest = []
output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    guide = (root / 'README.md').read_text(encoding='utf-8')
    guide = guide.replace('](docs/', '](archivos/docs/')
    archive.writestr('README.md', guide)
    for relative, file in sorted(files.items()):
        data = file.read_bytes()
        archive.writestr('archivos/' + relative, data)
        manifest.append({'ruta': relative, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    instructions = {'ruta': 'README.md', 'sha256': hashlib.sha256(guide.encode('utf-8')).hexdigest()}
    archive.writestr('MANIFIESTO.json', json.dumps({'tipo': 'integracion-fuentes', 'instrucciones': instructions, 'archivos': manifest}, indent=2) + '\n')
with zipfile.ZipFile(output) as archive:
    if archive.testzip() is not None:
        raise SystemExit('Falló la verificación de integridad del ZIP.')
print(json.dumps({'zip': str(output), 'archivos': len(files), 'bytes': output.stat().st_size,
                  'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}, indent=2))
