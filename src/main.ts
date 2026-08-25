import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

import { AppModule } from './app/app.module';

/*
 * One bootstrap, not two.
 *
 * This used to call bootstrapApplication(AppComponent) as well, right
 * after bootstrapModule(AppModule). That started the application a second
 * time against the same <app-root>, from an injector with none of the
 * providers AppModule supplies -- no IonicModule.forRoot(), no router, no
 * Firebase -- which is where the NG0201 "no provider" error at startup
 * came from, and why screens rendered as unstyled HTML: the second,
 * provider-less instance is the one that won.
 *
 * AppComponent is `standalone: false`, so bootstrapApplication was never
 * the right call for it in the first place; its failure was swallowed by
 * the .catch() next to it.
 */
platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));

defineCustomElements(window);
