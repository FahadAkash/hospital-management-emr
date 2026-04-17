using DanpheEMR.CommonTypes;
using DanpheEMR.Core.Configuration;
using DanpheEMR.DalLayer;
using DanpheEMR.Enums;
using DanpheEMR.Security;
using DanpheEMR.ServerModel;
using DanpheEMR.ServerModel.PatientModels;
using DanpheEMR.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using System;
using System.IdentityModel.Tokens.Jwt;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace DanpheEMR.Controllers.Patient
{
    [Route("api/[controller]")]
    public class PatientPortalController : Controller
    {
        private readonly string _connString;
        private readonly DanpheHTTPResponse<object> _response;

        public PatientPortalController(IOptions<MyConfiguration> config)
        {
            _connString = config.Value.Connectionstring;
            _response = new DanpheHTTPResponse<object>
            {
                Status = ENUM_Danphe_HTTP_ResponseStatus.OK
            };
        }

        [HttpPost("RegisterByAdminInvite")]
        public IActionResult RegisterByAdminInvite([FromBody] PortalRegisterRequest request)
        {
            return Execute(() =>
            {
                var staffUser = GetCurrentStaffUser();
                if (staffUser == null)
                {
                    throw new Exception("Unauthorized access. Staff login required.");
                }
                ValidateRegisterRequest(request);

                using (var patientDb = new PatientDbContext(_connString))
                {
                    var patient = patientDb.Patients.FirstOrDefault(p => p.PatientId == request.PatientId && p.IsActive);
                    if (patient == null)
                    {
                        throw new Exception("Patient not found.");
                    }

                    if (!string.Equals(patient.PhoneNumber, request.PhoneNumber?.Trim(), StringComparison.OrdinalIgnoreCase))
                    {
                        throw new Exception("Phone number mismatch with patient record. Staff must update phone from patient master first.");
                    }

                    var existing = patientDb.PatientPortalUsers.FirstOrDefault(u => u.PatientId == request.PatientId);
                    if (existing != null)
                    {
                        existing.LoginPhoneNumber = request.PhoneNumber.Trim();
                        existing.PasswordHash = RBAC.EncryptPassword(request.Password.Trim());
                        existing.IsActive = true;
                        existing.ModifiedBy = staffUser.EmployeeId;
                        existing.ModifiedOn = DateTime.Now;
                    }
                    else
                    {
                        patientDb.PatientPortalUsers.Add(new PatientPortalUserModel
                        {
                            PatientId = request.PatientId,
                            LoginPhoneNumber = request.PhoneNumber.Trim(),
                            PasswordHash = RBAC.EncryptPassword(request.Password.Trim()),
                            IsActive = true,
                            CreatedOn = DateTime.Now,
                            CreatedBy = staffUser.EmployeeId
                        });
                    }
                    patientDb.SaveChanges();
                    return new { Message = "Patient portal account created/updated successfully." };
                }
            });
        }

        [HttpPost("Login")]
        public IActionResult Login([FromBody] PortalLoginRequest request)
        {
            return Execute(() =>
            {
                if (request == null || string.IsNullOrWhiteSpace(request.Password) || string.IsNullOrWhiteSpace(request.LoginId))
                {
                    throw new Exception("LoginId and Password are required.");
                }
                using (var patientDb = new PatientDbContext(_connString))
                {
                    var loginId = request.LoginId.Trim();
                    var user = (from u in patientDb.PatientPortalUsers
                                join p in patientDb.Patients on u.PatientId equals p.PatientId
                                where u.IsActive && p.IsActive
                                && (u.LoginPhoneNumber == loginId || p.PatientCode == loginId)
                                select u).FirstOrDefault();

                    if (user == null || !string.Equals(user.PasswordHash, RBAC.EncryptPassword(request.Password.Trim()), StringComparison.Ordinal))
                    {
                        throw new Exception("Invalid login credentials.");
                    }

                    user.LastLoginOn = DateTime.Now;
                    patientDb.SaveChanges();
                    HttpContext.Session.Set("currentpatientportaluser", new PatientPortalSessionModel
                    {
                        PatientPortalUserId = user.PatientPortalUserId,
                        PatientId = user.PatientId
                    });
                    return new { Message = "Login successful." };
                }
            });
        }

        [HttpPost("Logout")]
        public IActionResult Logout()
        {
            return Execute(() =>
            {
                HttpContext.Session.Remove("currentpatientportaluser");
                return new { Message = "Logged out successfully." };
            });
        }

        [HttpPost("ForgotPassword/SendOtp")]
        public IActionResult SendOtp([FromBody] PortalForgotPasswordRequest request)
        {
            return Execute(() =>
            {
                if (request == null || string.IsNullOrWhiteSpace(request.LoginId))
                {
                    throw new Exception("LoginId is required.");
                }

                using (var patientDb = new PatientDbContext(_connString))
                {
                    var loginId = request.LoginId.Trim();
                    var user = (from u in patientDb.PatientPortalUsers
                                join p in patientDb.Patients on u.PatientId equals p.PatientId
                                where u.IsActive && p.IsActive
                                && (u.LoginPhoneNumber == loginId || p.PatientCode == loginId)
                                select u).FirstOrDefault();
                    if (user == null)
                    {
                        throw new Exception("Patient portal account not found.");
                    }

                    var otp = GenerateOtp(6);
                    var now = DateTime.Now;
                    var otpRef = Guid.NewGuid().ToString("N");

                    patientDb.PatientPortalOtps.Add(new PatientPortalOtpModel
                    {
                        PatientId = user.PatientId,
                        PhoneNumber = user.LoginPhoneNumber,
                        OtpHash = ComputeSha256Hash(otp),
                        Purpose = "password-reset",
                        CreatedOn = now,
                        ExpiresOn = now.AddMinutes(10),
                        IsUsed = false,
                        OtpReference = otpRef
                    });
                    patientDb.SaveChanges();

                    // NOTE: Integrate SMS gateway here using user.LoginPhoneNumber and otp.
                    return new { Message = "OTP sent to registered phone number.", OtpReference = otpRef };
                }
            });
        }

        [HttpPost("ForgotPassword/VerifyOtpAndReset")]
        public IActionResult VerifyOtpAndReset([FromBody] PortalResetPasswordRequest request)
        {
            return Execute(() =>
            {
                if (request == null || string.IsNullOrWhiteSpace(request.OtpReference) || string.IsNullOrWhiteSpace(request.OtpCode) || string.IsNullOrWhiteSpace(request.NewPassword))
                {
                    throw new Exception("OtpReference, OtpCode and NewPassword are required.");
                }

                using (var patientDb = new PatientDbContext(_connString))
                {
                    var otpEntry = patientDb.PatientPortalOtps
                        .Where(o => o.OtpReference == request.OtpReference && !o.IsUsed && o.ExpiresOn >= DateTime.Now)
                        .OrderByDescending(o => o.PatientPortalOtpId)
                        .FirstOrDefault();

                    if (otpEntry == null || !string.Equals(otpEntry.OtpHash, ComputeSha256Hash(request.OtpCode.Trim()), StringComparison.OrdinalIgnoreCase))
                    {
                        throw new Exception("Invalid or expired OTP.");
                    }

                    var user = patientDb.PatientPortalUsers.FirstOrDefault(u => u.PatientId == otpEntry.PatientId && u.IsActive);
                    if (user == null)
                    {
                        throw new Exception("Patient portal account not found.");
                    }

                    user.PasswordHash = RBAC.EncryptPassword(request.NewPassword.Trim());
                    user.ModifiedOn = DateTime.Now;
                    otpEntry.IsUsed = true;
                    otpEntry.UsedOn = DateTime.Now;
                    patientDb.SaveChanges();
                    return new { Message = "Password reset successful." };
                }
            });
        }

        [HttpPut("ChangePassword")]
        public IActionResult ChangePassword([FromBody] PortalChangePasswordRequest request)
        {
            return Execute(() =>
            {
                var portalSession = GetCurrentPortalSession();
                if (portalSession == null)
                {
                    throw new Exception("Unauthorized access.");
                }
                if (request == null || string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
                {
                    throw new Exception("CurrentPassword and NewPassword are required.");
                }

                using (var patientDb = new PatientDbContext(_connString))
                {
                    var user = patientDb.PatientPortalUsers.FirstOrDefault(u => u.PatientPortalUserId == portalSession.PatientPortalUserId && u.IsActive);
                    if (user == null)
                    {
                        throw new Exception("Patient portal account not found.");
                    }
                    if (!string.Equals(user.PasswordHash, RBAC.EncryptPassword(request.CurrentPassword.Trim()), StringComparison.Ordinal))
                    {
                        throw new Exception("Current password is incorrect.");
                    }

                    user.PasswordHash = RBAC.EncryptPassword(request.NewPassword.Trim());
                    user.ModifiedOn = DateTime.Now;
                    patientDb.SaveChanges();
                    return new { Message = "Password changed successfully." };
                }
            });
        }

        [HttpGet("MyProfile")]
        public IActionResult MyProfile()
        {
            return Execute(() =>
            {
                var portalSession = GetCurrentPortalSession();
                if (portalSession == null)
                {
                    throw new Exception("Unauthorized access.");
                }

                using (var patientDb = new PatientDbContext(_connString))
                {
                    var patient = patientDb.Patients.FirstOrDefault(p => p.PatientId == portalSession.PatientId && p.IsActive);
                    if (patient == null)
                    {
                        throw new Exception("Patient not found.");
                    }

                    var profilePic = patientDb.PatientFiles
                        .Where(f => f.PatientId == patient.PatientId && f.FileType == "profile-pic" && f.IsActive == true)
                        .OrderByDescending(f => f.PatientFileId)
                        .Select(f => new { f.PatientFileId, f.FileName })
                        .FirstOrDefault();

                    return new
                    {
                        patient.PatientId,
                        patient.PatientCode,
                        patient.FirstName,
                        patient.MiddleName,
                        patient.LastName,
                        patient.PhoneNumber,
                        patient.DateOfBirth,
                        patient.Email,
                        ProfilePicture = profilePic,
                        EditableFields = new[] { "FirstName", "MiddleName", "LastName", "Password", "ProfilePicture" },
                        NonEditableFields = new[] { "PhoneNumber", "DateOfBirth", "Gender", "Address", "Email", "PatientCode" }
                    };
                }
            });
        }

        [HttpPut("MyProfile")]
        public IActionResult UpdateProfile([FromBody] PortalUpdateProfileRequest request)
        {
            return Execute(() =>
            {
                var portalSession = GetCurrentPortalSession();
                if (portalSession == null)
                {
                    throw new Exception("Unauthorized access.");
                }
                if (request == null)
                {
                    throw new Exception("Invalid request.");
                }

                using (var patientDb = new PatientDbContext(_connString))
                {
                    var patient = patientDb.Patients.FirstOrDefault(p => p.PatientId == portalSession.PatientId && p.IsActive);
                    if (patient == null)
                    {
                        throw new Exception("Patient not found.");
                    }

                    // Allowed edits for patient: name and profile picture only.
                    if (!string.IsNullOrWhiteSpace(request.FirstName)) patient.FirstName = request.FirstName.Trim();
                    patient.MiddleName = request.MiddleName?.Trim();
                    if (!string.IsNullOrWhiteSpace(request.LastName)) patient.LastName = request.LastName.Trim();
                    patient.ModifiedOn = DateTime.Now;

                    // Phone editing is intentionally blocked: only hospital staff can change phone.
                    if (!string.IsNullOrWhiteSpace(request.PhoneNumber) && !string.Equals(request.PhoneNumber.Trim(), patient.PhoneNumber, StringComparison.Ordinal))
                    {
                        throw new Exception("Phone number cannot be changed from patient portal. Please contact hospital staff.");
                    }

                    if (!string.IsNullOrWhiteSpace(request.ProfilePictureBase64) && !string.IsNullOrWhiteSpace(request.ProfilePictureExtension))
                    {
                        SaveProfilePicture(patientDb, portalSession.PatientId, request.ProfilePictureBase64, request.ProfilePictureExtension);
                    }

                    patientDb.SaveChanges();
                    return new { Message = "Profile updated successfully." };
                }
            });
        }

        [HttpGet("MyHistory")]
        public IActionResult MyHistory()
        {
            return Execute(() =>
            {
                var portalSession = GetCurrentPortalSession();
                if (portalSession == null)
                {
                    throw new Exception("Unauthorized access.");
                }

                var patientId = portalSession.PatientId;
                using (var patientDb = new PatientDbContext(_connString))
                using (var billingDb = new BillingDbContext(_connString))
                using (var labDb = new LabDbContext(_connString))
                using (var radioDb = new RadiologyDbContext(_connString))
                using (var clinicalDb = new ClinicalDbContext(_connString))
                {
                    var patient = patientDb.Patients.Where(p => p.PatientId == patientId).Select(p => new
                    {
                        p.PatientId,
                        p.PatientCode,
                        p.FirstName,
                        p.MiddleName,
                        p.LastName,
                        p.PhoneNumber
                    }).FirstOrDefault();

                    var billing = billingDb.BillingTransactions
                        .Where(b => b.PatientId == patientId)
                        .OrderByDescending(b => b.CreatedOn)
                        .Select(b => new
                        {
                            b.BillingTransactionId,
                            b.InvoiceNo,
                            b.CreatedOn,
                            b.TransactionType,
                            b.BillStatus,
                            b.TotalAmount,
                            b.PaidAmount
                        }).Take(500).ToList();

                    var admissions = patientDb.Admissions
                        .Where(a => a.PatientId == patientId)
                        .OrderByDescending(a => a.AdmissionDate)
                        .Select(a => new
                        {
                            a.PatientAdmissionId,
                            a.PatientVisitId,
                            a.AdmissionDate,
                            a.DischargeDate,
                            a.AdmissionStatus
                        }).Take(200).ToList();

                    var bedHistory = patientDb.PatientBedInfos
                        .Where(b => b.PatientId == patientId)
                        .OrderByDescending(b => b.StartedOn)
                        .Select(b => new
                        {
                            b.PatientBedInfoId,
                            b.PatientVisitId,
                            b.WardId,
                            b.BedId,
                            b.StartedOn,
                            b.EndedOn,
                            b.BedPrice,
                            b.BedQuantity
                        }).Take(500).ToList();

                    var visits = patientDb.Visits
                        .Where(v => v.PatientId == patientId)
                        .OrderByDescending(v => v.VisitDate)
                        .Select(v => new
                        {
                            v.PatientVisitId,
                            v.VisitCode,
                            v.VisitDate,
                            v.VisitType,
                            v.VisitStatus,
                            v.PerformerName,
                            v.DepartmentId
                        }).Take(500).ToList();

                    var lab = labDb.Requisitions
                        .Where(l => l.PatientId == patientId)
                        .OrderByDescending(l => l.CreatedOn)
                        .Select(l => new
                        {
                            l.RequisitionId,
                            l.LabTestName,
                            l.OrderDateTime,
                            l.OrderStatus,
                            l.BillingStatus,
                            l.IsActive
                        }).Take(500).ToList();

                    var radiology = radioDb.ImagingRequisitions
                        .Where(r => r.PatientId == patientId)
                        .OrderByDescending(r => r.CreatedOn)
                        .Select(r => new
                        {
                            r.ImagingRequisitionId,
                            r.ImagingTypeName,
                            r.ImagingItemName,
                            r.ImagingDate,
                            r.OrderStatus,
                            r.BillingStatus,
                            r.IsReportSaved
                        }).Take(500).ToList();

                    var prescriptions = clinicalDb.MedicationPrescriptions
                        .Where(m => m.PatientId == patientId)
                        .OrderByDescending(m => m.CreatedOn)
                        .Select(m => new
                        {
                            m.MedicationPrescriptionId,
                            m.MedicationId,
                            m.Route,
                            m.Dose,
                            m.Frequency,
                            m.Duration,
                            m.DurationType,
                            m.CreatedOn
                        }).Take(500).ToList();

                    var yearlyPurchases = billing
                        .GroupBy(b => b.CreatedOn.Year)
                        .Select(g => new
                        {
                            Year = g.Key,
                            TotalPurchaseAmount = g.Sum(x => x.TotalAmount),
                            TotalPaidAmount = g.Sum(x => x.PaidAmount),
                            InvoiceCount = g.Count()
                        })
                        .OrderByDescending(x => x.Year)
                        .ToList();

                    return new
                    {
                        Patient = patient,
                        Billing = billing,
                        Admissions = admissions,
                        BedHistory = bedHistory,
                        Visits = visits,
                        Lab = lab,
                        Radiology = radiology,
                        Prescriptions = prescriptions,
                        YearlyPurchases = yearlyPurchases
                    };
                }
            });
        }

        private IActionResult Execute(Func<object> fn)
        {
            try
            {
                _response.Status = ENUM_Danphe_HTTP_ResponseStatus.OK;
                _response.ErrorMessage = null;
                _response.Results = fn.Invoke();
            }
            catch (Exception ex)
            {
                _response.Status = ENUM_Danphe_HTTP_ResponseStatus.Failed;
                _response.ErrorMessage = ex.Message;
                _response.Results = null;
            }
            return Ok(_response);
        }

        private void ValidateRegisterRequest(PortalRegisterRequest request)
        {
            if (request == null || request.PatientId <= 0 || string.IsNullOrWhiteSpace(request.PhoneNumber) || string.IsNullOrWhiteSpace(request.Password))
            {
                throw new Exception("PatientId, PhoneNumber and Password are required.");
            }
        }

        private RbacUser GetCurrentStaffUser()
        {
            var sessionUser = HttpContext.Session.Get<RbacUser>("currentuser");
            if (sessionUser != null)
            {
                return sessionUser;
            }

            var tokenFromHeader = HttpContext.Request.Headers["Authorization"].ToString();
            if (!string.IsNullOrWhiteSpace(tokenFromHeader) && tokenFromHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                var token = tokenFromHeader.Split(' ')[1];
                var handler = new JwtSecurityTokenHandler();
                var jwtToken = handler.ReadJwtToken(token);
                var userClaim = jwtToken.Claims.FirstOrDefault(cl => cl.Type == ENUM_ClaimTypes.currentUser)?.Value;
                if (!string.IsNullOrWhiteSpace(userClaim))
                {
                    return DanpheJSONConvert.DeserializeObject<RbacUser>(userClaim);
                }
            }
            return null;
        }

        private PatientPortalSessionModel GetCurrentPortalSession()
        {
            return HttpContext.Session.Get<PatientPortalSessionModel>("currentpatientportaluser");
        }

        private static string GenerateOtp(int length)
        {
            var random = new Random();
            var sb = new StringBuilder();
            for (var i = 0; i < length; i++)
            {
                sb.Append(random.Next(0, 10));
            }
            return sb.ToString();
        }

        private static string ComputeSha256Hash(string rawData)
        {
            using (SHA256 sha256Hash = SHA256.Create())
            {
                byte[] bytes = sha256Hash.ComputeHash(Encoding.UTF8.GetBytes(rawData));
                var builder = new StringBuilder();
                for (int i = 0; i < bytes.Length; i++)
                {
                    builder.Append(bytes[i].ToString("x2"));
                }
                return builder.ToString();
            }
        }

        private void SaveProfilePicture(PatientDbContext patientDb, int patientId, string base64Data, string extension)
        {
            var folderPath = patientDb.CFGParameters
                .Where(p => p.ParameterGroupName.ToLower() == "patient" && p.ParameterName == "PatientProfilePicImageUploadLocation")
                .Select(p => p.ParameterValue)
                .FirstOrDefault();

            if (string.IsNullOrWhiteSpace(folderPath))
            {
                throw new Exception("Patient profile picture location is not configured.");
            }

            if (!Directory.Exists(folderPath))
            {
                Directory.CreateDirectory(folderPath);
            }

            var cleanExt = extension.Trim().TrimStart('.').ToLower();
            var fileName = $"pat_{patientId}_{DateTime.Now:yyyyMMddHHmmssfff}.{cleanExt}";
            var filePath = Path.Combine(folderPath, fileName);
            var bytes = Convert.FromBase64String(base64Data);
            System.IO.File.WriteAllBytes(filePath, bytes);

            var activePics = patientDb.PatientFiles.Where(f => f.PatientId == patientId && f.FileType == "profile-pic" && f.IsActive == true).ToList();
            foreach (var pic in activePics)
            {
                pic.IsActive = false;
            }

            patientDb.PatientFiles.Add(new PatientFilesModel
            {
                PatientId = patientId,
                FileName = fileName,
                IsActive = true,
                FileNo = 1,
                UploadedBy = 0,
                UploadedOn = DateTime.Now,
                FileType = "profile-pic",
                FileExtention = "." + cleanExt
            });
        }
    }

    public class PortalRegisterRequest
    {
        public int PatientId { get; set; }
        public string PhoneNumber { get; set; }
        public string Password { get; set; }
    }

    public class PortalLoginRequest
    {
        public string LoginId { get; set; }
        public string Password { get; set; }
    }

    public class PortalForgotPasswordRequest
    {
        public string LoginId { get; set; }
    }

    public class PortalResetPasswordRequest
    {
        public string OtpReference { get; set; }
        public string OtpCode { get; set; }
        public string NewPassword { get; set; }
    }

    public class PortalChangePasswordRequest
    {
        public string CurrentPassword { get; set; }
        public string NewPassword { get; set; }
    }

    public class PortalUpdateProfileRequest
    {
        public string FirstName { get; set; }
        public string MiddleName { get; set; }
        public string LastName { get; set; }
        public string PhoneNumber { get; set; }
        public string ProfilePictureBase64 { get; set; }
        public string ProfilePictureExtension { get; set; }
    }
}
