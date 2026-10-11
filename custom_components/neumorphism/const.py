"""Konstanten für die Neumorphism-Integration."""

DOMAIN = "neumorphism"
VERSION = "7.1.1"

STATIC_URL = "/neumorphism_static"
JS_FILE = "neumorphism-colors.js"
# Nicht "themes" nennen: HACS löscht beim Herunterladen jede .yaml-Datei,
# deren Pfad "themes" enthält (Altcode für Theme-Repositories).
THEMES_DIR = "theme"
THEMES_FILE = "neumorphism.yaml"
