import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

/*
 * One Ionic package, not two.
 *
 * This module used to call IonicModule.forRoot() from '@ionic/angular' while
 * every page imported its components from '@ionic/angular/standalone'. Those
 * are two different builds of the same custom elements: whichever registers
 * first wins the tag names, and the standalone build reads its configuration
 * -- including `mode` -- from provideIonicAngular(), which nothing called.
 *
 * The result was visible on every screen: elements hydrated with
 * class="item undefined item-lines-full" instead of "item md item-lines-full",
 * and since Ionic scopes all of its component CSS under .md / .ios, none of it
 * applied. Rows, inputs, buttons and icons rendered as bare HTML no matter what
 * the theme said. Bringing the shell onto the standalone package and providing
 * the config once fixes it for the whole app.
 */
import {
  IonApp,
  IonRouterOutlet,
  IonicRouteStrategy,
  provideIonicAngular,
} from '@ionic/angular/standalone';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';

import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';

import { environment } from '../environments/environment';
import { HttpClientModule } from '@angular/common/http';
import { provideFirestore } from '@angular/fire/firestore';
import { getFirestore } from 'firebase/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,

    // AppComponent's template is <ion-app><ion-router-outlet>, so the shell
    // needs those two standalone components in scope.
    IonApp,
    IonRouterOutlet,

    AppRoutingModule,

    // Firebase compat
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireAuthModule,
    AngularFirestoreModule,

    HttpClientModule,
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },

    // Material Design on every platform. The app runs on Android hardware and
    // as a PWA; pinning the mode keeps one look instead of letting an iPhone
    // browser silently switch the whole UI to the iOS styling.
    provideIonicAngular({ mode: 'md' }),

    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
