import { newDemoProject, newProject } from './demo-templates.js';

export function setupNewTemplateDialog({getBus,database,drafts,install,status,root=document}) {
  const dialog = root.querySelector('#new-dialog');
  dialog.addEventListener('click',async event=> {
    const button = event.target.closest('[data-template],[data-demo-template]');
    if (!button || button.disabled || !dialog.open || database.busy || database.pending) return;
    const context = getBus();
    const {template,demoTemplate} = button.dataset;
    try {
      const project = demoTemplate ? newDemoProject(demoTemplate) : newProject(template === 'blank' ? 'invoice' : template,template === 'blank');
      const next = database.starting(project);
      dialog.close();
      await drafts.guard(()=>install(next.project,next.reference,'builtin-demo'),true,{
        context,
        onApplied:()=>status('Edits applied to the current form. Save it before starting another form.')
      });
    } catch (error) { status(error.message); }
  });
}
