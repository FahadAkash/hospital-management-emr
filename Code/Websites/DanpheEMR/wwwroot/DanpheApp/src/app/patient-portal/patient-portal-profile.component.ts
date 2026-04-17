import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { PatientPortalService } from "./shared/patient-portal.service";

@Component({
  selector: "patient-portal-profile",
  templateUrl: "./patient-portal-profile.component.html",
})
export class PatientPortalProfileComponent implements OnInit {
  public profile: any = null;
  public model: any = {
    firstName: "",
    middleName: "",
    lastName: "",
    phoneNumber: "",
    profilePictureBase64: "",
    profilePictureExtension: "jpg",
  };
  public passwordModel: any = { currentPassword: "", newPassword: "" };
  public message: string = "";
  public errorMessage: string = "";

  constructor(private portalService: PatientPortalService, private router: Router) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  public loadProfile(): void {
    this.portalService.myProfile().subscribe(
      (res: any) => {
        if (res && res.Status === "OK" && res.Results) {
          this.profile = res.Results;
          this.model.firstName = this.profile.FirstName || "";
          this.model.middleName = this.profile.MiddleName || "";
          this.model.lastName = this.profile.LastName || "";
          this.model.phoneNumber = this.profile.PhoneNumber || "";
        } else {
          this.errorMessage = "Unable to load profile.";
        }
      },
      () => (this.errorMessage = "Unable to load profile.")
    );
  }

  public onProfilePicSelected(files: FileList): void {
    if (!files || files.length === 0) {
      return;
    }
    const file = files[0];
    const parts = file.name.split(".");
    this.model.profilePictureExtension = parts.length > 1 ? parts[parts.length - 1] : "jpg";
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result ? reader.result.toString() : "";
      this.model.profilePictureBase64 = result.indexOf(",") > -1 ? result.split(",")[1] : result;
    };
    reader.readAsDataURL(file);
  }

  public saveProfile(): void {
    this.message = "";
    this.errorMessage = "";
    this.portalService.updateProfile({
      firstName: this.model.firstName,
      middleName: this.model.middleName,
      lastName: this.model.lastName,
      phoneNumber: this.model.phoneNumber,
      profilePictureBase64: this.model.profilePictureBase64,
      profilePictureExtension: this.model.profilePictureExtension,
    }).subscribe(
      (res: any) => {
        if (res && res.Status === "OK") {
          this.message = "Profile updated successfully.";
          this.loadProfile();
        } else {
          this.errorMessage = res && res.ErrorMessage ? res.ErrorMessage : "Profile update failed.";
        }
      },
      () => (this.errorMessage = "Profile update failed.")
    );
  }

  public changePassword(): void {
    this.message = "";
    this.errorMessage = "";
    this.portalService.changePassword(this.passwordModel).subscribe(
      (res: any) => {
        if (res && res.Status === "OK") {
          this.message = "Password changed successfully.";
          this.passwordModel = { currentPassword: "", newPassword: "" };
        } else {
          this.errorMessage = res && res.ErrorMessage ? res.ErrorMessage : "Password change failed.";
        }
      },
      () => (this.errorMessage = "Password change failed.")
    );
  }

  public goToHistory(): void {
    this.router.navigate(["/PatientPortal/History"]);
  }

  public logout(): void {
    this.portalService.logout().subscribe(() => {
      this.router.navigate(["/PatientPortal/Login"]);
    });
  }
}
