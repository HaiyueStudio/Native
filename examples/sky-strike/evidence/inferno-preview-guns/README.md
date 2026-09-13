# Inferno level preview gun attachments

The mission 11 preview now composes both gun sprites over the original square hull. Preview and combat share mount/pivot dimensions. Child sprites resize with the hull, are noninteractive, and are reused/hidden across level changes.

Validation:
- 90 focused Sky Strike tests passed.
- Scoped Sky Strike + browser fixture TypeScript check passed using the repository compiler options.
- Registered inferno-menu-zh/en/ja scenarios passed; each checks two visible attachments, mount alignment, and three next/back cycles without duplicate children. Chinese screenshot visually reviewed.
- Targeted Sky Strike web build passed.
- Full Games typecheck has unrelated Neon Circuit errors. Full npm test was bounded at 120 seconds; unrelated MUGEN asset/viewer failures and pending Petra test remain. These files were not changed for this task.

Native deployment included in the subsequent boss-preview-panel update; see its build/install/startup evidence.
