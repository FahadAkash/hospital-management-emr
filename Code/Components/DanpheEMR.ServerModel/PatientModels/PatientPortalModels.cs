using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DanpheEMR.ServerModel.PatientModels
{
    [Table("PAT_PortalUser")]
    public class PatientPortalUserModel
    {
        [Key]
        public int PatientPortalUserId { get; set; }
        public int PatientId { get; set; }
        [MaxLength(50)]
        public string LoginPhoneNumber { get; set; }
        [MaxLength(500)]
        public string PasswordHash { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedOn { get; set; }
        public int? CreatedBy { get; set; }
        public DateTime? ModifiedOn { get; set; }
        public int? ModifiedBy { get; set; }
        public DateTime? LastLoginOn { get; set; }
    }

    [Table("PAT_PortalOtp")]
    public class PatientPortalOtpModel
    {
        [Key]
        public long PatientPortalOtpId { get; set; }
        public int PatientId { get; set; }
        [MaxLength(50)]
        public string PhoneNumber { get; set; }
        [MaxLength(200)]
        public string OtpHash { get; set; }
        [MaxLength(100)]
        public string Purpose { get; set; }
        public DateTime CreatedOn { get; set; }
        public DateTime ExpiresOn { get; set; }
        public bool IsUsed { get; set; }
        public DateTime? UsedOn { get; set; }
        [MaxLength(200)]
        public string OtpReference { get; set; }
    }

    public class PatientPortalSessionModel
    {
        public int PatientPortalUserId { get; set; }
        public int PatientId { get; set; }
    }
}
