// Runs the real renderer with synthetic records only. No Firebase or PHI access.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/app/services/clinical-document-export.service.ts'), 'utf8');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators:true}}).outputText, {
  exports: exportsObject, require: name => name === '@angular/core' ? {Injectable:()=>target=>target,inject:()=>({})} : {}, Date, Map, Set,
});
const renderer = new exportsObject.ClinicalDocumentExportService();
const narrative = 'The documented wound findings and treatment were reviewed. Continue the clinician-entered plan and scheduled follow-up. '.repeat(24);
const records = [
  {kind:'woundAssessment',title:'Wound Assessment',records:[{id:'PRIVATE_RECORD',data:{
    describe:{location:'Right heel',type:'Pressure',stage:'Stage 3',acquired:'In-house acquired'},
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
  const runtime = process.env.CODEX_NODE_MODULES;
  if (!runtime) throw new Error('Set CODEX_NODE_MODULES to the bundled Node packages');
  const {chromium} = require(path.join(runtime,'playwright'));
  const browser = await chromium.launch({executablePath:process.env.CHROME_BIN || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:794,height:1123}});
    await page.setContent(html); await page.emulateMedia({media:'print'});
    await page.pdf({path:path.join(out,'phwc-clinical-layout-example.pdf'),format:'A4',preferCSSPageSize:true,printBackground:true});
    await page.screenshot({path:path.join(out,'phwc-clinical-layout-example.png'),fullPage:true});
    console.log('PASS actual renderer: PHI-free A4 PDF and screenshot generated');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
