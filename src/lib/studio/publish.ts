// Experience publish contract: what must hold before an experience can be
// frozen into an ExperienceVersion that fans will play.

import { validateSceneSchema } from "@/lib/engine/schema";
import type { EditableParameter, Experience, Scene, SceneSchema } from "@/types";

export interface PublishIssue {
  code:
    | "NO_SCENES"
    | "SCENE_NOT_FOUND"
    | "SCENE_FOREIGN"
    | "SCENE_INVALID"
    | "SCENE_EMPTY"
    | "PARAM_SCENE_MISSING"
    | "PARAM_OBJECT_MISSING"
    | "PARAM_PROPERTY_MISMATCH";
  message: string;
  sceneId?: string;
  parameterId?: string;
}

/** Interaction / group references that point at objects which do not exist. */
export function findBrokenReferences(schema: SceneSchema): string[] {
  const ids = new Set(schema.objects.map((o) => o.id));
  const broken: string[] = [];
  for (const m of schema.interactions) {
    if (!ids.has(m.objectId)) broken.push(`interaction ${m.id} → missing object ${m.objectId}`);
  }
  for (const o of schema.objects) {
    if (o.data.type === "group") {
      for (const child of o.data.childIds) if (!ids.has(child)) broken.push(`group ${o.id} → missing child ${child}`);
    }
    if (o.parentId !== null && !ids.has(o.parentId)) broken.push(`object ${o.id} → missing parent ${o.parentId}`);
  }
  return broken;
}

function parameterFitsObject(param: EditableParameter, schema: SceneSchema): PublishIssue | null {
  const obj = schema.objects.find((o) => o.id === param.objectId);
  if (!obj) {
    return {
      code: "PARAM_OBJECT_MISSING",
      message: `Parameter "${param.label}" targets an object that no longer exists`,
      parameterId: param.id,
      sceneId: param.sceneId,
    };
  }
  if (param.property === "data.content" && obj.data.type !== "text") {
    return {
      code: "PARAM_PROPERTY_MISMATCH",
      message: `Parameter "${param.label}" edits text content, but "${obj.name}" is not a text object`,
      parameterId: param.id,
      sceneId: param.sceneId,
    };
  }
  return null;
}

export function validateExperienceForPublish(
  experience: Experience,
  scenesById: Map<string, Scene | null>
): PublishIssue[] {
  const issues: PublishIssue[] = [];
  if (experience.scenes.length === 0) {
    issues.push({ code: "NO_SCENES", message: "Add at least one scene before publishing" });
  }

  for (const entry of experience.scenes) {
    const scene = scenesById.get(entry.sceneId) ?? null;
    if (!scene) {
      issues.push({ code: "SCENE_NOT_FOUND", message: `Scene ${entry.sceneId} does not exist`, sceneId: entry.sceneId });
      continue;
    }
    if (scene.artistId !== experience.artistId) {
      issues.push({ code: "SCENE_FOREIGN", message: `Scene ${entry.sceneId} belongs to another artist`, sceneId: entry.sceneId });
      continue;
    }
    const valid = validateSceneSchema(scene.schema);
    const broken = findBrokenReferences(scene.schema);
    if (!valid.success || broken.length > 0) {
      issues.push({
        code: "SCENE_INVALID",
        message: `Scene "${scene.name}" has an invalid schema${broken.length ? `: ${broken[0]}` : ""}`,
        sceneId: scene.id,
      });
    }
    if (scene.schema.objects.length === 0) {
      issues.push({ code: "SCENE_EMPTY", message: `Scene "${scene.name}" has no objects`, sceneId: scene.id });
    }
  }

  const sceneIds = new Set(experience.scenes.map((s) => s.sceneId));
  for (const param of experience.editableParameters) {
    const scene = scenesById.get(param.sceneId) ?? null;
    if (!sceneIds.has(param.sceneId) || !scene) {
      issues.push({
        code: "PARAM_SCENE_MISSING",
        message: `Parameter "${param.label}" belongs to a scene that is not in this experience`,
        parameterId: param.id,
        sceneId: param.sceneId,
      });
      continue;
    }
    const issue = parameterFitsObject(param, scene.schema);
    if (issue) issues.push(issue);
  }
  return issues;
}
