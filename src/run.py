# ============================================
# JS and CSS Combiner Script
# Combines all .js and .css files into one file
# ============================================

import os

# ============ Settings ============

# Folder to scan
INPUT_FOLDER = "./"

# Output file
OUTPUT_FILE = "combined_assets.txt"

# Include subfolders?
INCLUDE_SUBFOLDERS = True


# ============ File Collector ============

def collect_files(folder, extensions, recursive=True):
    found_files = []

    if recursive:
        for root, dirs, files in os.walk(folder):
            for file in files:
                if file.lower().endswith(extensions):
                    full_path = os.path.join(root, file)
                    found_files.append(full_path)
    else:
        for file in os.listdir(folder):
            full_path = os.path.join(folder, file)
            if os.path.isfile(full_path) and file.lower().endswith(extensions):
                found_files.append(full_path)

    return sorted(found_files)


# ============ Combiner ============

def combine_files(file_list, output_file):
    with open(output_file, "w", encoding="utf-8") as out:

        for file_path in file_list:
            print(f"Adding: {file_path}")

            out.write("\n")
            out.write("=" * 60 + "\n")
            out.write(f"FILE: {file_path}\n")
            out.write("=" * 60 + "\n\n")

            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    out.write(f.read())
                    out.write("\n\n")
            except Exception as e:
                print(f"Failed to read {file_path}: {e}")


# ============ Main ============

def main():

    print("Scanning for JS and CSS files...")

    extensions = (".tsx", ".css", ".ts")

    files = collect_files(
        INPUT_FOLDER,
        extensions,
        recursive=INCLUDE_SUBFOLDERS
    )

    print(f"Found {len(files)} files")

    if not files:
        print("No files found.")
        return

    combine_files(files, OUTPUT_FILE)

    print(f"\nDone. Combined file saved as: {OUTPUT_FILE}")


# ============ Entry Point ============

if __name__ == "__main__":
    main()