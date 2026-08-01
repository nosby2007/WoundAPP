import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

  platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.log(err));
  
  bootstrapApplication(AppComponent)
  .catch(err => console.error(err));

// 👇 à la fin
defineCustomElements(window);
