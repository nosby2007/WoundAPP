import { EnvironmentProviders, Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { of } from 'rxjs';

import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore } from '@angular/fire/firestore';
import { disableNetwork, getFirestore } from 'firebase/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';

import { environment } from '../environments/environment';

/**
 * What a page component needs to be constructed in a test.
 *
 * The generated `should create` specs for this app's pages had never once
 * run: the suite did not compile, and once it did they all failed on
 * `No provider found for ActivatedRoute`. They are smoke tests -- they prove
 * only that a page's constructor and field initializers do not throw -- but
 * that is not nothing here, where several pages read a route parameter in a
 * field initializer and would fail at first paint.
 *
 * The Firebase providers are the SAME ones app.module.ts registers, called
 * the same way, with Firestore put into offline mode so a page that
 * subscribes a query on init does not spend the rest of the run retrying a
 * backend the test runner cannot reach. No emulator, no credentials, no
 * network.
 */

/** A route with no parameters, which is what most of these pages see in a test. */
export function provideStubActivatedRoute(params: Record<string, string> = {}): Provider {
  const paramMap: ParamMap = convertToParamMap(params);
  return {
    provide: ActivatedRoute,
    useValue: {
      snapshot: { paramMap, queryParamMap: convertToParamMap({}), params, data: {} },
      paramMap: of(paramMap),
      queryParamMap: of(convertToParamMap({})),
      params: of(params),
      data: of({}),
    },
  };
}

/**
 * @param params Route parameters the page under test reads, e.g.
 *   `{ patientId: 'p1' }`. Pages that read one in a field initializer get a
 *   real value rather than null, so the test exercises the same path a real
 *   navigation would.
 */
export function pageTestProviders(params: Record<string, string> = {}): Array<Provider | EnvironmentProviders> {
  return [
    provideRouter([]),
    provideStubActivatedRoute(params),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() => {
      const firestore = getFirestore();
      // Offline on purpose. These pages subscribe a query in ngOnInit, and
      // detectChanges() runs it -- against a backend the test runner cannot
      // reach. The client would then retry for the rest of the run and karma
      // would kill the browser for going quiet, AFTER reporting every test as
      // passing. Saying "offline" once is the difference between a suite that
      // finishes and one that hangs having already told you it was fine.
      void disableNetwork(firestore);
      return firestore;
    }),
    provideStorage(() => getStorage()),
  ];
}
