import type { MindmapProject } from './types';

export type HistoryState = {
  past: MindmapProject[];
  future: MindmapProject[];
};

const MAX_HISTORY_STEPS = 50;

function cloneProject(project: MindmapProject): MindmapProject {
  return JSON.parse(JSON.stringify(project)) as MindmapProject;
}

export function createHistoryState(): HistoryState {
  return {
    past: [],
    future: [],
  };
}

export function pushHistory(
  history: HistoryState,
  currentProject: MindmapProject,
): HistoryState {
  return {
    past: [...history.past, cloneProject(currentProject)].slice(-MAX_HISTORY_STEPS),
    future: [],
  };
}

export function undoHistory(
  history: HistoryState,
  currentProject: MindmapProject,
) {
  const previousProject = history.past[history.past.length - 1];

  if (!previousProject) {
    return null;
  }

  return {
    project: cloneProject(previousProject),
    history: {
      past: history.past.slice(0, -1),
      future: [cloneProject(currentProject), ...history.future].slice(
        0,
        MAX_HISTORY_STEPS,
      ),
    },
  };
}

export function redoHistory(
  history: HistoryState,
  currentProject: MindmapProject,
) {
  const nextProject = history.future[0];

  if (!nextProject) {
    return null;
  }

  return {
    project: cloneProject(nextProject),
    history: {
      past: [...history.past, cloneProject(currentProject)].slice(
        -MAX_HISTORY_STEPS,
      ),
      future: history.future.slice(1),
    },
  };
}
