// Polyfill for libraries that expect Node's global (e.g. sockjs-client, stompjs)
(window as unknown as { global?: unknown }).global = window;

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
