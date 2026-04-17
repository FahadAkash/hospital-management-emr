using Microsoft.AspNetCore.Mvc;

namespace DanpheEMR.Controllers.Patient
{
    [Route("PatientPortal")]
    public class PatientPortalViewController : Controller
    {
        [HttpGet("Login")]
        public IActionResult Login()
        {
            return Redirect("/Home/Index#/PatientPortal/Login");
        }

        [HttpGet("Profile")]
        public IActionResult Profile()
        {
            return Redirect("/Home/Index#/PatientPortal/Profile");
        }

        [HttpGet("History")]
        public IActionResult History()
        {
            return Redirect("/Home/Index#/PatientPortal/History");
        }
    }
}
