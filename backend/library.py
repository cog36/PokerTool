"""Local imports: validate content, keep uploads in the project, never overwrite."""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIBRARY_ROOTS = {'hands': ROOT / 'hand_histories', 'tournaments': ROOT / 'tournament_summaries'}


def hand_files():
    root = LIBRARY_ROOTS['hands']
    return [{'id': str(path.relative_to(root)), 'name': path.name, 'bytes': path.stat().st_size}
            for path in sorted(root.rglob('*.txt')) if path.is_file() and path.resolve().is_relative_to(root.resolve())]


def saved_hand_path(file_id):
    root = LIBRARY_ROOTS['hands'].resolve()
    path = (root / file_id).resolve()
    if not path.is_relative_to(root) or path.suffix.lower() != '.txt' or not path.is_file():
        raise ValueError('Choose an existing hand-history file from the list.')
    return path


def store_import(kind, filename, content):
    if kind not in LIBRARY_ROOTS:
        raise ValueError('Unknown library')
    basename = Path(filename.replace('\\', '/')).name
    if Path(basename).suffix.lower() != '.txt':
        raise ValueError('Choose a .txt export.')
    # Content is validated by the endpoint before reaching this function.
    destination = LIBRARY_ROOTS[kind] / 'uploads'
    if not destination.resolve().is_relative_to(LIBRARY_ROOTS[kind].resolve()):
        raise ValueError('Import folder must remain inside the local library.')
    destination.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(content).hexdigest()[:12]
    stem = re.sub(r'[^\w .-]', '_', Path(basename).stem)[:110] or 'import'
    target = destination / f'{stem}-{digest}.txt'
    try:
        with target.open('xb') as output:
            output.write(content)
        duplicate = False
    except FileExistsError:
        if target.read_bytes() != content:
            raise ValueError('An import with this name already exists.') from None
        duplicate = True
    return {'file': str(target.relative_to(LIBRARY_ROOTS[kind])), 'already_imported': duplicate}
