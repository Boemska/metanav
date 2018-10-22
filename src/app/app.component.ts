import { Component } from '@angular/core';
import { VERSION } from 'environments/version';

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent {

  public version = VERSION.version;
  public hashPart = VERSION.hash;

  constructor() { }
}
