/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG,
 * RUAN VAN ZYL
 *
 * File Function:
 * Saves an exported CSV: on the Android app it is written to
 * Documents/Skeletal Coordinate App/, in a browser it is downloaded.
 * Returns where the file went so the app can tell the user.
 */

import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { downloadFile } from "./projectStorage";

export interface CsvExportResult {
  destination: "documents" | "download";
  displayPath: string;
}

export async function exportCsv(contents: string, filename: string): Promise<CsvExportResult> {
  if (Capacitor.isNativePlatform()) {
    const relativePath = `Skeletal Coordinate App/${filename}`;
    await Filesystem.writeFile({
      path: relativePath,
      data: contents,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    return { destination: "documents", displayPath: `Documents/${relativePath}` };
  }

  downloadFile(contents, filename, "text/csv;charset=utf-8");
  return { destination: "download", displayPath: filename };
}
