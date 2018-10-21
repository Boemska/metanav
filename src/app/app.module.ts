import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { ClarityModule } from 'clarity-angular';
import { AppComponent } from './app.component';
import { ROUTING } from "./app.routing";
import { NotFoundComponent } from './not-found/not-found.component';
import { SidenavComponent } from './sidenav/sidenav.component';

import { BoemskaModule } from './boemska/boemska.module';

import { MetanavService } from './metanav.service';
import { ObjectsComponent } from './objects/objects.component';
import { DetailsComponent } from './details/details.component';
import { StartupComponent } from './startup/startup.component';

@NgModule({
  declarations: [
    AppComponent,
    NotFoundComponent,
    SidenavComponent,
    ObjectsComponent,
    DetailsComponent,
    StartupComponent
  ],
  imports: [
    BrowserAnimationsModule,
    BrowserModule,
    FormsModule,
    HttpModule,
    ClarityModule.forRoot(),
    ROUTING,
    BoemskaModule
  ],
  providers: [MetanavService],
  bootstrap: [AppComponent]
})
export class AppModule {
}
