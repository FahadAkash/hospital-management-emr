using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace DanpheEMR
{
    /*
       Author: Krishna, 
       Creation: 19thMay'23
       Purpose: 1. Make Startup Clean and Readable
                2. To Achieve Separation of Concerns
                3. Startup class was getting bulky, which leads to less  maintainable code.
    */
    public static class ConfigureServices
    {
        public static IServiceCollection AddSwaggerAndJwtServices(this IServiceCollection services, IConfigurationRoot Configuration)
        {
            // Add Swagger
            services.AddSwaggerGen(config =>
            {
                config.SwaggerDoc("v1", new OpenApiInfo
                {
                    Title = "DanpheEMR APIs",
                    Version = "v1",
                    Contact = new OpenApiContact()
                    {
                        Name = "DanpheEMR",
                        Email = "info.danphe-emr.com",
                        Url = new Uri("https://danphehealth.com/")
                    },
                    Description = "We are testing Swagger in DanpheEMR",
                    TermsOfService = new Uri("https://danphehealth.com/terms")
                });
                config.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
                {
                    In = ParameterLocation.Header,
                    Description = "Please enter your JWT token here starting with Bearer followed by single white space",
                    Name = "Authorization",
                    Type = SecuritySchemeType.ApiKey
                });

                config.AddSecurityRequirement(new OpenApiSecurityRequirement
                {
                    {
                        new OpenApiSecurityScheme
                        {
                            Reference = new OpenApiReference
                            {
                                Type = ReferenceType.SecurityScheme,
                                Id = "Bearer"
                            }
                        },
                        new string[] { }
                    }
                });

                //DanpheEmrAPI.xml file is created by the Project>build event
                //and it is read by swagger to show in the api documentation.
                //We can show: <summary>, <remarks>, <response>
                var filePath = Path.Combine(System.AppContext.BaseDirectory, "DanpheEmrAPI.xml");
                config.IncludeXmlComments(filePath);

            });


            //Add JWT
            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            // Adding Jwt Bearer
            .AddJwtBearer(options =>
            {
                options.SaveToken = true;
                options.RequireHttpsMetadata = false;
                options.TokenValidationParameters = new TokenValidationParameters()
                {
                    // The signing key must match!
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Configuration["JwtTokenConfig:JwtKey"])),
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ValidAudience = Configuration["JwtTokenConfig:JwtAudience"],
                    ValidIssuer = Configuration["JwtTokenConfig:JwtIssuer"]
                };
            });
            return services;
        }
    }
}
