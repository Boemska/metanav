import { Component } from '@angular/core';
import { VERSION } from 'environments/version';
import { MetanavService } from './metanav.service';
import { Router, NavigationEnd} from '@angular/router';
import { Subscription } from 'rxjs/Subscription';


@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent {

  public version = VERSION.version;
  public hashPart = VERSION.hash;
  public sidenavSwitch: string = 'sidenavON';
  public sidenavShow: boolean = true;
  private _linkSub: Subscription;
  
  constructor(
    private _metanavService: MetanavService,
    private _router: Router
  ) { }

  public toggleSidenav() {
    this.sidenavSwitch === 'sidenavON' ? this.sidenavSwitch = 'sidenavOFF' : this.sidenavSwitch = 'sidenavON';
    this._setSidenavToggleState();
    this.sidenavShow = !this.sidenavShow;
  }

  private _setSidenavToggleState(): void {
    this._metanavService.setSidenavToggleState(this.sidenavSwitch);
  }

  ngOnInit() {
    this._linkSub = this._router.events.subscribe(
      async (ev) => { 
       if (ev instanceof  NavigationEnd) {
        let urlArr = ev.url.split('/');
        if (urlArr.indexOf('object') !== -1) {
          this.sidenavShow = false;
        } 
        if (urlArr.length == 2) {
          this.sidenavShow = true;
        } 
       }
      });
  }
}
