import { assertPolicyCurrent } from "../core/data-policy.js";

let designerSkillPromise;

export async function loadCurrentDesignerSkill(options) {
  const check = () => {
    options.assertCurrentContext?.();
    if (options.dataPolicy && options.getDataPolicy) assertPolicyCurrent(options.dataPolicy, options.getDataPolicy());
  };
  check();
  const Agrun = options.Agrun;
  if (!Agrun?.parseSkillMarkdown) return [];
  if (!designerSkillPromise) {
    designerSkillPromise = fetch(new URL("../agent-skills/printform-designer.md", import.meta.url))
      .then((response) => {
        if (!response.ok) throw new Error(`Designer skill unavailable (${response.status})`);
        return response.text();
      })
      .then((markdown) => {
        const skill = Agrun.parseSkillMarkdown(markdown);
        return skill ? [skill] : [];
      })
      .catch(() => []);
  }
  const skills = await designerSkillPromise;
  check();
  return skills;
}
