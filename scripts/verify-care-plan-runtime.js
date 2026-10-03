const fs = require('fs');
const assert = require('assert');

const page = fs.readFileSync('src/app/pages/wound-care-plan/wound-care-plan.page.ts', 'utf8');
const template = fs.readFileSync('src/app/pages/wound-care-plan/wound-care-plan.page.html', 'utf8');
const service = fs.readFileSync('src/app/services/care-plan.service.ts', 'utf8');

assert(!template.includes('Organization templates'), 'The unstable template selector must not return to the mobile care plan.');
assert(!page.includes('get goalOptions()'), 'Care-plan options must keep a stable identity on mobile Safari.');
assert(page.includes('goalOptions: CarePlanCatalogEntry[] = []'), 'Care-plan options must be cached.');
assert(page.includes('takeUntilDestroyed(this.destroyRef)'), 'Category subscription must be lifecycle-bound.');
assert(service.includes('organizations/${orgId}/carePlanCatalog'), 'Care plans must use the organization catalog source of truth.');
assert(!service.includes('carePlanTemplates'), 'Care plans must not introduce a second template source of truth.');

console.log('PASS care plan runtime: stable mobile options and canonical catalog enforced.');
