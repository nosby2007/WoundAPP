// Runs the real renderer with synthetic records only. No Firebase or PHI access.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/app/services/clinical-document-export.service.ts'), 'utf8');
const exportsObject = {};
let mockCollections = {};
const firestore = {
  doc: (_db, ...parts) => parts.join('/'), collection: (_db, p) => p,
  getDoc: async p => ({exists:()=>p.startsWith('patients/'),data:()=>({name:'Sample Patient (test only)',dob:'1970-01-01',orgId:'PHWC'})}),
  getDocs: async p => ({docs:(mockCollections[p] || []).map(r=>({id:r.id,data:()=>structuredClone(r.data)}))}),
};
vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators:true}}).outputText, {
  exports: exportsObject, require: name => name === '@angular/core' ? {Injectable:()=>target=>target,inject:()=>({})} : name === 'firebase/firestore' ? firestore : {}, Date, Map, Set,
});
const renderer = new exportsObject.ClinicalDocumentExportService();
const narrative = 'The documented wound findings and treatment were reviewed. Continue the clinician-entered plan and scheduled follow-up. '.repeat(24);
const records = [
  {kind:'woundAssessment',title:'Wound Assessment',records:[{id:'PRIVATE_RECORD',data:{
    describe:{location:'Right heel',type:'Pressure',stage:'Stage 3',acquired:'In-house acquired'},
    assessedAt:'2026-10-04T14:00:00Z',woundId:'PRIVATE_WOUND',orgId:'PHWC',photoURL:'https://synthetic.example/wound.png',
    printMeasurementHistory:[
      {assessedAt:'2026-09-20T14:00:00Z',measurements:{area:12,depth:0.4}},
      {assessedAt:'2026-09-27T14:00:00Z',measurements:{area:9,depth:0.3}},
      {assessedAt:'2026-10-04T14:00:00Z',measurements:{area:7.5,depth:0.2}}
    ],
    measurements:{length:3,width:2.5,depth:0.2,area:7.5,volume:1.5,tunneling:'None',undermining:'None'},
    woundBed:{slough:{present:true,percent:70},granulation:{present:false},infection:'Redness/inflammation'},
    exudate:{amount:'Moderate',type:'Serosanguineous',odor:'None'},pain:{score:2,frequency:'None'},
    periwound:{edges:'Attached',surrounding:['Callus','Maceration'],temperature:'Cool'},
    treatment:{cleansing:'Normal saline',primary:'Xeroform',additionalCare:['Offloading']},
    authorIdentity:{displayName:'Sample Nurse',credentials:'RN',uid:'PRIVATE_NURSE'},
    providerReview:{providerNote:narrative,reviewedByName:'Sample NP',decision:'Concur'},
    esign:{signed:true,signerDisplayName:'Sample NP',signedAtIso:'2026-10-04T14:00:00Z'}}}]},
  {kind:'systemic',title:'Systemic Assessment',records:[{id:'PRIVATE_SYSTEMIC',data:{answers:{systems:{general:'Alert',cardiovascular:'Documented cardiovascular findings',musculoskeletal:'Mobility reviewed'},clinicalSummary:'Synthetic layout validation only.'}}}]},
];
const html = renderer.documentHtml({name:'Sample Patient (test only)',dob:'1970-01-01'},records);
if (html.includes('PRIVATE_') || html.includes('Generated from the clinical chart')) throw new Error('Technical metadata leak');
const out = path.join(root, 'output', 'pdf'); fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'phwc-clinical-layout-example.html'),html);
(async()=>{
  mockCollections = {
    'patients/PRIVATE_PATIENT/woundVisits':[{id:'PRIVATE_VISIT',data:{appointmentId:'PRIVATE_APPOINTMENT',orgId:'PHWC',visitType:'routine',performedByName:'Sample Nurse',scheduledFor:'2026-10-04T14:00:00Z',checkIn:{at:'2026-10-04T14:00:00Z'},checkOut:{at:'2026-10-04T14:45:00Z'}}}],
    'patients/PRIVATE_PATIENT/woundAssessments': records[0].records.map(r=>({id:r.id,data:{...r.data,visitId:'PRIVATE_VISIT'}})),
  };
  const visitHtml = await renderer.buildVisitPacket('PRIVATE_PATIENT','PRIVATE_VISIT',null);
  mockCollections['patients/PRIVATE_PATIENT/woundAssessments'].push(
    {id:'older',data:{woundId:'PRIVATE_WOUND',orgId:'PHWC',assessedAt:'2026-09-20T14:00:00Z',measurements:{area:12}}},
    {id:'future',data:{woundId:'PRIVATE_WOUND',orgId:'PHWC',assessedAt:'2026-10-05T14:00:00Z',measurements:{area:100}}},
    {id:'different',data:{woundId:'OTHER_WOUND',orgId:'PHWC',assessedAt:'2026-09-20T14:00:00Z',measurements:{area:200}}},
    {id:'tenant',data:{woundId:'PRIVATE_WOUND',orgId:'OTHER',assessedAt:'2026-09-20T14:00:00Z',measurements:{area:300}}}
  );
  const selected = await renderer.loadSection('PRIVATE_PATIENT','woundAssessment','PRIVATE_RECORD');
  const history = selected.records[0].data.printMeasurementHistory;
  if (history.length !== 2 || history.some(r=>r.measurements.area >= 100)) throw new Error('History must stay within wound, organization and selected assessment date');
  if (visitHtml.includes('PRIVATE_') || visitHtml.includes('Location status')) throw new Error('Visit packet leaks backend fields');
  let rejected = false;
  try { await renderer.buildVisitPacket('PRIVATE_PATIENT','MISSING_VISIT',null); } catch { rejected = true; }
  if (!rejected) throw new Error('Missing requested visit must not fall back to an unrelated encounter');
  fs.writeFileSync(path.join(out,'phwc-visit-layout-example.html'),visitHtml);
  const runtime = process.env.CODEX_NODE_MODULES;
  if (!runtime) throw new Error('Set CODEX_NODE_MODULES to the bundled Node packages');
  const {chromium} = require(path.join(runtime,'playwright'));
  const browser = await chromium.launch({executablePath:process.env.CHROME_BIN || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:794,height:1123}});
    await page.route('https://synthetic.example/**', route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="180" height="100"><rect width="180" height="100" fill="#eef7f3"/><text x="15" y="50" font-size="12">Synthetic photo fixture</text></svg>'}));
    await page.setContent(html); await page.emulateMedia({media:'print'});
    await page.pdf({path:path.join(out,'phwc-clinical-layout-example.pdf'),format:'A4',preferCSSPageSize:true,printBackground:true});
    await page.screenshot({path:path.join(out,'phwc-clinical-layout-example.png'),fullPage:true});
    await page.setContent(visitHtml);
    await page.screenshot({path:path.join(out,'phwc-visit-layout-example.png'),fullPage:true});
    console.log('PASS actual renderer: PHI-free A4 PDF and screenshot generated');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
