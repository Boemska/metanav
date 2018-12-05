import { Component } from '@angular/core';
import { VERSION } from 'environments/version';
import { MetanavService } from './metanav.service';

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent {

  public version = VERSION.version;
  public hashPart = VERSION.hash;
  public sidenavSwitch: string = 'sidenavON';
  public sidenavShow: boolean = false
  
  constructor(
    private _metanavService: MetanavService
  ) { }

  public toggleSidenav() {
    this.sidenavSwitch === 'sidenavON' ? this.sidenavSwitch = 'sidenavOFF' : this.sidenavSwitch = 'sidenavON';
    this._setSidenavToggleState();
    this.sidenavShow = !this.sidenavShow;
  }

  private _setSidenavToggleState(): void {
    this._metanavService.setSidenavToggleState(this.sidenavSwitch);
  }
}
