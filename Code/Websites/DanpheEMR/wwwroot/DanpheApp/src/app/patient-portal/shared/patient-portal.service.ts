import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";

@Injectable({
  providedIn: "root",
})
export class PatientPortalService {
  constructor(private http: HttpClient) {}

  public login(payload: { loginId: string; password: string }) {
    return this.http.post<any>("/api/PatientPortal/Login", payload);
  }

  public logout() {
    return this.http.post<any>("/api/PatientPortal/Logout", {});
  }

  public myProfile() {
    return this.http.get<any>("/api/PatientPortal/MyProfile");
  }

  public updateProfile(payload: any) {
    return this.http.put<any>("/api/PatientPortal/MyProfile", payload);
  }

  public changePassword(payload: { currentPassword: string; newPassword: string }) {
    return this.http.put<any>("/api/PatientPortal/ChangePassword", payload);
  }

  public myHistory() {
    return this.http.get<any>("/api/PatientPortal/MyHistory");
  }
}
