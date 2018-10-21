import { TestBed, inject } from '@angular/core/testing';

import { MetanavService } from './metanav.service';

describe('MetanavService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MetanavService]
    });
  });

  it('should be created', inject([MetanavService], (service: MetanavService) => {
    expect(service).toBeTruthy();
  }));
});
