IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PAT_PortalUser]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[PAT_PortalUser]
    (
        [PatientPortalUserId] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [PatientId] INT NOT NULL,
        [LoginPhoneNumber] NVARCHAR(50) NOT NULL,
        [PasswordHash] NVARCHAR(500) NOT NULL,
        [IsActive] BIT NOT NULL CONSTRAINT [DF_PAT_PortalUser_IsActive] DEFAULT(1),
        [CreatedOn] DATETIME NOT NULL CONSTRAINT [DF_PAT_PortalUser_CreatedOn] DEFAULT(GETDATE()),
        [CreatedBy] INT NULL,
        [ModifiedOn] DATETIME NULL,
        [ModifiedBy] INT NULL,
        [LastLoginOn] DATETIME NULL
    );

    CREATE UNIQUE NONCLUSTERED INDEX [IX_PAT_PortalUser_PatientId]
        ON [dbo].[PAT_PortalUser]([PatientId]);

    CREATE NONCLUSTERED INDEX [IX_PAT_PortalUser_LoginPhoneNumber]
        ON [dbo].[PAT_PortalUser]([LoginPhoneNumber]);

    ALTER TABLE [dbo].[PAT_PortalUser]
    ADD CONSTRAINT [FK_PAT_PortalUser_PAT_Patient]
        FOREIGN KEY([PatientId]) REFERENCES [dbo].[PAT_Patient]([PatientId]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PAT_PortalOtp]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[PAT_PortalOtp]
    (
        [PatientPortalOtpId] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [PatientId] INT NOT NULL,
        [PhoneNumber] NVARCHAR(50) NOT NULL,
        [OtpHash] NVARCHAR(200) NOT NULL,
        [Purpose] NVARCHAR(100) NOT NULL,
        [CreatedOn] DATETIME NOT NULL CONSTRAINT [DF_PAT_PortalOtp_CreatedOn] DEFAULT(GETDATE()),
        [ExpiresOn] DATETIME NOT NULL,
        [IsUsed] BIT NOT NULL CONSTRAINT [DF_PAT_PortalOtp_IsUsed] DEFAULT(0),
        [UsedOn] DATETIME NULL,
        [OtpReference] NVARCHAR(200) NULL
    );

    CREATE NONCLUSTERED INDEX [IX_PAT_PortalOtp_PatientId]
        ON [dbo].[PAT_PortalOtp]([PatientId]);

    CREATE NONCLUSTERED INDEX [IX_PAT_PortalOtp_OtpReference]
        ON [dbo].[PAT_PortalOtp]([OtpReference]);

    ALTER TABLE [dbo].[PAT_PortalOtp]
    ADD CONSTRAINT [FK_PAT_PortalOtp_PAT_Patient]
        FOREIGN KEY([PatientId]) REFERENCES [dbo].[PAT_Patient]([PatientId]);
END;
GO
