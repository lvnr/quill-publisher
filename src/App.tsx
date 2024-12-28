import { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useFBX } from "@react-three/drei";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import "./App.css";
import * as THREE from "three";
import { exportProject } from "./utils/exporter";
import { convertFileSrc } from "@tauri-apps/api/core";

declare global {
  interface Window {
    fbxObjects?: { [key: string]: THREE.Object3D };
    originalMaterials?: { [key: string]: THREE.Material | THREE.Material[] };
  }
}

interface QuillLayer {
  Name: string;
  Type: string;
  Visible: boolean;
  Implementation?: {
    Children?: QuillLayer[];
  };
}

interface QuillProject {
  Version: number;
  Sequence: {
    RootLayer: QuillLayer;
  };
}

// Add this new type for handling layer updates
type LayerUpdateFunction = (
  layerId: string,
  updates: Partial<QuillLayer>
) => void;

function EyeOpenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
    </svg>
  );
}

function LightModeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z" />
    </svg>
  );
}

function DarkModeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" />
    </svg>
  );
}

function Scene({ fbxPath }: { fbxPath: string }) {
  const fbx = useFBX(convertFileSrc(fbxPath));

  useEffect(() => {
    if (!fbxPath) return;

    try {
      console.log("Loaded FBX:", fbx);
      window.fbxObjects = {};
      window.originalMaterials = {};

      fbx.traverse((object) => {
        if (object.name) {
          if (typeof window.fbxObjects !== "undefined") {
            window.fbxObjects[object.name] = object;
            // Check specifically for Mesh objects
            if (
              object instanceof THREE.Mesh &&
              typeof window.originalMaterials !== "undefined"
            ) {
              window.originalMaterials[object.name] = object.material;
            }
          }
        }
      });

      // Create a map of all objects in the FBX by name
      const objectsByName: { [key: string]: THREE.Object3D } = {};
      fbx.traverse((object) => {
        if (object.name) {
          objectsByName[object.name] = object;
        }
      });

      // Log available object names for debugging
      // console.log("Available objects:", Object.keys(objectsByName));
    } catch (error) {
      console.error("Error loading FBX:", error);
    }
  }, [fbxPath]);

  return (
    <>
      <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
      <ambientLight intensity={1.0} />
      <directionalLight position={[5, 5, 5]} intensity={2} castShadow />
      <directionalLight position={[-5, -5, -5]} intensity={1} />

      <gridHelper
        args={[20, 40]}
        position={[0, -0.01, 0]}
        material-opacity={0.1}
        material-transparent={true}
      />

      {fbx && (
        <primitive
          object={fbx}
          scale={1.0}
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
        />
      )}
    </>
  );
}

function LayerItem({
  layer,
  depth = 0,
  onUpdateLayer,
  parentVisible = true,
}: {
  layer: QuillLayer;
  depth?: number;
  onUpdateLayer: LayerUpdateFunction;
  parentVisible?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(layer.Name);

  const hasChildren = (layer?.Implementation?.Children?.length ?? 0) > 0;
  const hasFBXObject = !!window.fbxObjects?.[layer.Name];

  // Effective visibility is determined by both the layer's visibility and its parent's visibility
  const effectivelyVisible = parentVisible && layer.Visible;

  const handleNameClick = () => {
    setIsEditing(true);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedName(e.target.value);
  };

  const handleNameUpdate = () => {
    setIsEditing(false);
    if (editedName !== layer.Name) {
      onUpdateLayer(layer.Name, { Name: editedName });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleNameUpdate();
    }
  };

  const handleVisibilityToggle = () => {
    onUpdateLayer(layer.Name, { Visible: !layer.Visible });

    const object = window.fbxObjects?.[layer.Name];
    if (object) {
      object.visible = !layer.Visible;
    }
  };

  const handleMouseEnter = () => {
    const object = window.fbxObjects?.[layer.Name];
    if (object) {
      console.log("Hovering over object:", object);
      // Traverse all children of this object
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Store original material if not already stored
          if (!window.originalMaterials) {
            window.originalMaterials = {};
          }
          if (!window.originalMaterials[child.name]) {
            window.originalMaterials[child.name] = child.material;
          }
          // Apply highlight material
          const highlightMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
          });
          child.material = highlightMaterial;
        }
      });
    }
  };

  const handleMouseLeave = () => {
    const object = window.fbxObjects?.[layer.Name];
    if (object) {
      // Traverse all children of this object
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Restore original material
          const originalMaterial = window.originalMaterials?.[child.name];
          if (originalMaterial) {
            child.material = originalMaterial;
          }
        }
      });
    }
  };

  return (
    <div className={`layer-item ml-[${depth * 2}px]`}>
      <div className="layer-row">
        {hasChildren && (
          <button
            className="expand-button px-0.5"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "▼" : "▶"}
          </button>
        )}
        {hasFBXObject && (
          <button
            className={`bg-transparent border-none p-0.5 ${
              parentVisible ? "cursor-pointer" : "cursor-default"
            } ${effectivelyVisible ? "opacity-100" : "opacity-50"} ${
              hasFBXObject ? "text-inherit" : "text-gray-600"
            }`}
            onClick={handleVisibilityToggle}
            title={layer.Visible ? "Hide Layer" : "Show Layer"}
            disabled={!parentVisible}
          >
            {effectivelyVisible ? <EyeOpenIcon /> : <EyeClosedIcon />}
          </button>
        )}
        {isEditing ? (
          <input
            type="text"
            value={editedName}
            onChange={handleNameChange}
            onBlur={handleNameUpdate}
            onKeyDown={handleKeyDown}
            autoFocus
            className="text-left px-0.5 h-5 ml-3"
          />
        ) : (
          <span
            className="layer-name text-left inline-block cursor-pointer px-0.5 leading-5 ml-3"
            onClick={handleNameClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {layer.Name}
          </span>
        )}
        <span className="layer-type min-w-[60px] inline-block text-sm text-gray-600 text-left">
          ({layer.Type})
        </span>
      </div>

      {isExpanded && hasChildren && (
        <div className="layer-children mt-0.5">
          {layer?.Implementation?.Children?.map((child, index) => (
            <LayerItem
              key={`${child.Name}-${index}`}
              layer={child}
              depth={depth + 1}
              onUpdateLayer={onUpdateLayer}
              parentVisible={effectivelyVisible}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [isDarkMode, setIsDarkMode] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [project, setProject] = useState<QuillProject | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [tempFBXPath, setTempFBXPath] = useState<string | null>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const updateLayer = (layerId: string, updates: Partial<QuillLayer>) => {
    setProject((currentProject) => {
      if (!currentProject) return null;

      const updateLayerRecursive = (layer: QuillLayer): QuillLayer => {
        if (layer.Name === layerId) {
          return { ...layer, ...updates };
        }

        if (layer.Implementation?.Children) {
          return {
            ...layer,
            Implementation: {
              ...layer.Implementation,
              Children: layer.Implementation.Children.map(updateLayerRecursive),
            },
          };
        }

        return layer;
      };

      return {
        ...currentProject,
        Sequence: {
          ...currentProject.Sequence,
          RootLayer: updateLayerRecursive(currentProject.Sequence.RootLayer),
        },
      };
    });
  };

  async function loadProject() {
    try {
      const folderPath = await open({
        directory: true,
      });
      const filePath = folderPath ? `${folderPath}/Quill.json` : null;

      if (filePath) {
        const contents = await readTextFile(filePath as string);
        const projectData = JSON.parse(contents);
        console.log("loaded projectData", projectData);
        setTempFBXPath(null);
        const tempFBXPath = await exportProject(
          folderPath as string,
          "FBX",
          true
        );
        setProjectPath(folderPath);
        setProject(projectData);
        setTempFBXPath(tempFBXPath);
      }
    } catch (error) {
      console.error("Error loading project:", error);
    }
  }

  async function saveProject() {
    if (!project) return;

    try {
      const filePath = await save({
        filters: [
          {
            name: "Quill Project",
            extensions: ["json"],
          },
        ],
      });

      if (filePath) {
        await writeTextFile(filePath, JSON.stringify(project, null, 2));
      }
    } catch (error) {
      console.error("Error saving project:", error);
    }
  }

  async function handleExport(format: "FBX" | "Alembic") {
    if (!projectPath) return;

    try {
      await exportProject(projectPath as string, format);
    } catch (error) {
      console.error(`Failed to export as ${format}:`, error);
    }
  }

  return (
    <main className="container">
      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        className="absolute z-10 p-2 transition-colors rounded-full top-4 right-4 hover:bg-gray-200 dark:hover:bg-gray-700"
        title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
      </button>

      <div className="canvas-container">
        {tempFBXPath && (
          <Canvas camera={{ position: [5, 5, 5], fov: 60 }} shadows>
            <Scene fbxPath={tempFBXPath as string} />
          </Canvas>
        )}
      </div>

      <div className="ui-layer">
        <div className="relative flex flex-col items-start ui-layer-header">
          <h1 className="mb-2 text-2xl font-bold">Quill Publisher</h1>
          {projectPath && (
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Project: {projectPath}
            </p>
          )}

          <div className="flex gap-x-2.5">
            <button onClick={loadProject}>Load Project</button>
            <button onClick={saveProject} disabled={!project}>
              Save Project
            </button>
            <button onClick={() => handleExport("Alembic")} disabled={!project}>
              Export Alembic
            </button>
          </div>
        </div>

        {project && (
          <div className="layers-container">
            <h2>Layers</h2>
            <LayerItem
              layer={project.Sequence.RootLayer}
              onUpdateLayer={updateLayer}
            />
          </div>
        )}
      </div>
    </main>
  );
}

export default App;
