import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { PatientPortalService } from "./shared/patient-portal.service";

@Component({
  selector: "patient-portal-login",
  templateUrl: "./patient-portal-login.component.html",
})
export class PatientPortalLoginComponent {
  public loginId: string = "";
  public password: string = "";
  public loading: boolean = false;
  public errorMessage: string = "";

  constructor(private portalService: PatientPortalService, private router: Router) {}

  public doLogin(): void {
    this.errorMessage = "";
    if (!this.loginId || !this.password) {
      this.errorMessage = "Login ID and password are required.";
      return;
    }
    this.loading = true;
    this.portalService.login({ loginId: this.loginId, password: this.password }).subscribe(
      (res: any) => {
        this.loading = false;
        if (res && res.Status === "OK") {
          this.router.navigate(["/PatientPortal/Profile"]);
        } else {
          this.errorMessage = res && res.ErrorMessage ? res.ErrorMessage : "Login failed.";
        }
      },
      () => {
        this.loading = false;
        this.errorMessage = "Login failed. Please try again.";
      }
    );
  }
}
