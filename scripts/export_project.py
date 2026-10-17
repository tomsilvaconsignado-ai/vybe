#!/usr/bin/env python3
import os
import zipfile
import shutil

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC_DIR = os.path.join(ROOT_DIR, 'public')
ZIP_OUT_ROOT = os.path.join(ROOT_DIR, 'vybe-project.zip')
ZIP_OUT_PUBLIC = os.path.join(PUBLIC_DIR, 'vybe-project.zip')

os.makedirs(PUBLIC_DIR, exist_ok=True)

# Exclude list
EXCLUDE_DIRS = {
    'node_modules',
    '.git',
    'dist',
    'coverage',
    '.aistudio'
}

EXCLUDE_FILES = {
    'vybe-project.zip',
    '.DS_Store'
}

def create_project_zip(dest_path):
    print(f"Compactando projeto para: {dest_path}...")
    with zipfile.ZipFile(dest_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(ROOT_DIR):
            # Prune excluded directories
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

            for file in files:
                if file in EXCLUDE_FILES or file.endswith('.zip'):
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, ROOT_DIR)
                zipf.write(full_path, rel_path)
    print(f"Sucesso! Arquivo criado com tamanho: {os.path.getsize(dest_path)} bytes")

if __name__ == '__main__':
    create_project_zip(ZIP_OUT_ROOT)
    shutil.copy2(ZIP_OUT_ROOT, ZIP_OUT_PUBLIC)
    print(f"Cópia pública criada em: {ZIP_OUT_PUBLIC}")
