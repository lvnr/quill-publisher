import { Command } from "@tauri-apps/plugin-shell";
import { writeTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { save } from "@tauri-apps/plugin-dialog";
import * as path from "@tauri-apps/api/path";

export type ExportFormat = "FBX" | "Alembic" | "USD" | "USDZ" | "IMM";

interface ExportSettings {
  Exporter: string;
  InputFile: string;
  ExtraInputs: string[];
  OutputFile: string;
  ExportOptions: {
    AbortOnErrors: boolean;
    ExportHidden: boolean;
    ExcludeList: string[];
    GroupExtraInputs: boolean;
    Optimize: {
      Optimize: boolean;
      OptimizeKeepOldLayers: boolean;
      OptimizeSimplifyThreshold: number;
      OptimizeIncludeList: string[];
    };
    Asset: {
      UseFullName: boolean;
      ExportMeshes: boolean;
      ExportCurves: boolean;
      BakeTransforms: boolean;
      ExportUVs: boolean;
      ExportAnimation: boolean;
      MaterialPerLayer: boolean;
      ColorSpace: "Linear" | "sRGB";
      ExportExtraAttrs: boolean;
      SeparateAlphaChannel: boolean;
      FixFlip: boolean;
      Scale: number;
    };
    IMM: {
      CanGrab: boolean;
      ExportToSpaces: boolean;
      ExportOpusAudio: boolean;
      OpusBitRate: number;
    };
    Import: {
      RemoveCorruptStrokes: boolean;
      TryFixCorruptStrokes: boolean;
      RemoveDuplicates: boolean;
    };
  };
}

export async function exportProject(
  projectPath: string,
  format: ExportFormat,
  temp: boolean = false
): Promise<string> {
  try {
    // Ask user where to save the exported file
    const extension = format.toLowerCase();
    const outputPath = temp
      ? await path.join(
          await path.appCacheDir(),
          `temp_${Date.now()}.${extension}`
        )
      : await save({
          filters: [
            {
              name: format,
              extensions: [extension],
            },
          ],
        });

    if (!outputPath) {
      throw new Error("Export cancelled by user");
    }

    // Create temporary settings file with default values
    const settings: ExportSettings = {
      Exporter: format,
      InputFile: projectPath,
      ExtraInputs: [],
      OutputFile: outputPath,
      ExportOptions: {
        AbortOnErrors: false,
        ExportHidden: false,
        ExcludeList: [],
        GroupExtraInputs: false,
        Optimize: {
          Optimize: false,
          OptimizeKeepOldLayers: false,
          OptimizeSimplifyThreshold: 0.02,
          OptimizeIncludeList: [],
        },
        Asset: {
          UseFullName: false,
          ExportMeshes: true,
          ExportCurves: false,
          BakeTransforms: true,
          ExportUVs: true,
          ExportAnimation: true,
          MaterialPerLayer: false,
          ColorSpace: "Linear",
          ExportExtraAttrs: false,
          SeparateAlphaChannel: false,
          FixFlip: false,
          Scale: 1.0,
        },
        IMM: {
          CanGrab: false,
          ExportToSpaces: false,
          ExportOpusAudio: true,
          OpusBitRate: 96000,
        },
        Import: {
          RemoveCorruptStrokes: true,
          TryFixCorruptStrokes: true,
          RemoveDuplicates: false,
        },
      },
    };

    // Write temporary settings file with timestamp
    const timestamp = Date.now();
    const tempSettingsPath = `temp_export_settings_${timestamp}.json`;
    await writeTextFile(tempSettingsPath, JSON.stringify(settings, null, 2), {
      baseDir: BaseDirectory.AppCache,
    });

    // Run the QuillExporter command
    const cacheDirPath = await path.appCacheDir();
    const settingsPath = await path.join(cacheDirPath, tempSettingsPath);

    const command = Command.sidecar("binaries/QuillExporter", [settingsPath]);

    const output = await command.execute();

    console.log(output.stdout);

    console.log("Export completed successfully");

    return outputPath;
  } catch (error) {
    console.error("Export error:", error);
    throw error;
  }
}
