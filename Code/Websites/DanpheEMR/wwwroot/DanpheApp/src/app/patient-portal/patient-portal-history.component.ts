import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { PatientPortalService } from "./shared/patient-portal.service";

@Component({
  selector: "patient-portal-history",
  templateUrl: "./patient-portal-history.component.html",
})
export class PatientPortalHistoryComponent implements OnInit {
  public data: any = null;
  public errorMessage: string = "";

  constructor(private portalService: PatientPortalService, private router: Router) {}

  ngOnInit(): void {
    this.portalService.myHistory().subscribe(
      (res: any) => {
        if (res && res.Status === "OK") {
          this.data = res.Results;
        } else {
          this.errorMessage = res && res.ErrorMessage ? res.ErrorMessage : "Unable to load history.";
        }
      },
      () => (this.errorMessage = "Unable to load history.")
    );
  }

  public goProfile(): void {
    this.router.navigate(["/PatientPortal/Profile"]);
  }
}
