/*
 * Copyright (c) 2016 VMware, Inc. All Rights Reserved.
 * This software is released under MIT license.
 * The full license information can be found in LICENSE in the root directory of this project.
 */
import { ModuleWithProviders } from '@angular/core/src/metadata/ng_module';
import { Routes, RouterModule } from '@angular/router';

import { NotFoundComponent } from './not-found/not-found.component';

import { ApplicationLogsComponent } from './boemska/logs/application-logs/application-logs.component';
import { DebugLogsComponent } from './boemska/logs/debug-logs/debug-logs.component';
import { FailedRequestsComponent } from './boemska/logs/failed-requests/failed-requests.component';
import { ErrorsComponent } from './boemska/logs/errors/errors.component';
import { ObjectsComponent } from './objects/objects.component';
import { DetailsComponent } from './details/details.component';
import { StartupComponent } from './startup/startup.component';

export const ROUTES: Routes = [
  { path: '', redirectTo: 'startup', pathMatch: 'full' },
  { path: 'type/:sasObject', component: ObjectsComponent },
  { path: 'type/:sasObject/object/:sasDetail', component: DetailsComponent },
  { path: 'startup', component: StartupComponent },
  { path: 'application-logs', component: ApplicationLogsComponent },
  { path: 'debug-logs', component: DebugLogsComponent },
  { path: 'failed-requests', component: FailedRequestsComponent },
  { path: 'errors', component: ErrorsComponent },

  { path: '**', component: NotFoundComponent }
];

export const ROUTING: ModuleWithProviders = RouterModule.forRoot(ROUTES, { useHash: true });
