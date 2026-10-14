// Training platforms Range can connect to. Add a platform by adding a module with
// { id, name, kind, available, fields, consent, sync({secret, state, options, browser}) -> {workouts, state, info} }.
import sugarwod from "./sugarwod.js";
import sugarwodGym from "./sugarwod-gym.js";

// Researched but not connectable yet. Shown in the app so people know what's coming and why.
const planned = [
  { id: "hwpo", name: "HWPO Training", available: false,
    blurb: "No public API (the app runs on the Fitr platform). Next step: ask contact@hwpotraining.com for partner access, or add a login-based connector after inspecting the web app with a real account." },
  { id: "wodify", name: "Wodify", available: false,
    blurb: "Official API (api.wodify.com, admin-created key) covers the gym's workouts. Needs a gym admin key to build and test against." },
  { id: "pushpress", name: "PushPress", available: false,
    blurb: "Official API is for members, classes and check-ins, not workouts. Gyms using PushPress with SugarWOD are covered by SugarWOD." },
  { id: "wodup", name: "WodUp", available: false,
    blurb: "Public API in private beta, including athlete results. Needs beta access." },
];

export const CONNECTORS = Object.fromEntries([sugarwod, sugarwodGym].map((c) => [c.id, c]));
export const listProviders = () => [
  ...Object.values(CONNECTORS).map(({ id, name, kind, available, blurb, fields, consent }) => ({ id, name, kind, available, blurb, consent, fields: fields.map(({ key, label, type, required }) => ({ key, label, type, required })) })),
  ...planned,
];
