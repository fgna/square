import java.net.URI

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Build-time identity for independent Square communities.
val whiteLabelName = providers.gradleProperty("communityName").orElse("Square").get()
val whiteLabelId = providers.gradleProperty("communityAppId").orElse("com.community.app").get()
val whiteLabelUrl = providers.gradleProperty("communityUrl").orElse("").get().trimEnd('/')
require(whiteLabelId.matches(Regex("[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)+"))) {
    "communityAppId must be a valid Android application ID."
}
require(whiteLabelName.isNotBlank()) { "communityName may not be blank" }
require(whiteLabelUrl.isEmpty() || (
    URI(whiteLabelUrl).let { it.scheme == "https" && !it.host.isNullOrBlank() &&
        it.rawUserInfo == null && it.rawQuery == null && it.rawFragment == null &&
        (it.rawPath.isNullOrEmpty() || it.rawPath == "/") }
)) { "communityUrl must be an HTTPS origin without path, credentials, query or fragment." }

val whiteLabelVersionCode = providers.gradleProperty("communityVersionCode").orElse("1").get().toIntOrNull()
require(whiteLabelVersionCode != null && whiteLabelVersionCode in 1..2100000000) {
    "communityVersionCode must be an integer between 1 and 2100000000."
}
val whiteLabelVersionName = providers.gradleProperty("communityVersionName").orElse("1.0").get()
require(whiteLabelVersionName.isNotBlank()) { "communityVersionName may not be blank" }

// Build-type resources override the shared main icon without modifying upstream files.
val whiteLabelResources = providers.gradleProperty("communityResDir").orNull?.let { file(it) }
whiteLabelResources?.let { resources ->
    require(resources.isDirectory &&
        resources.resolve("drawable/ic_launcher_foreground.xml").isFile &&
        resources.resolve("values/colors.xml").isFile) {
        "communityResDir must contain drawable/ic_launcher_foreground.xml and values/colors.xml."
    }
}

val keystorePath = System.getenv("KEYSTORE_PATH")
val storePasswordValue = System.getenv("KEYSTORE_PASSWORD")
val keyAliasValue = System.getenv("KEY_ALIAS")
val keyPasswordValue = System.getenv("KEY_PASSWORD")
val releaseConfigured = listOf(keystorePath, storePasswordValue, keyAliasValue, keyPasswordValue).all { !it.isNullOrBlank() }

android {
    buildFeatures { buildConfig = true }
    // Preserve package identity for existing community-platform installations.
    namespace = "com.community.app"
    compileSdk = 35
    defaultConfig {
        applicationId = whiteLabelId
        resValue("string", "app_name", whiteLabelName)
        buildConfigField("String", "COMMUNITY_URL", "\"${whiteLabelUrl}\"")
        minSdk = 26
        targetSdk = 35
        versionCode = whiteLabelVersionCode!!
        versionName = whiteLabelVersionName
    }
    if (releaseConfigured) {
        signingConfigs {
            create("release") {
                storeFile = file(keystorePath!!)
                storePassword = storePasswordValue
                keyAlias = keyAliasValue!!
                keyPassword = keyPasswordValue
            }
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            if (releaseConfigured) signingConfig = signingConfigs.getByName("release")
        }
    }
    whiteLabelResources?.let { resources ->
        sourceSets.getByName("debug").res.srcDir(resources)
        sourceSets.getByName("release").res.srcDir(resources)
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

tasks.register("verifyReleaseSigning") {
    doLast {
        check(releaseConfigured && file(keystorePath!!).isFile) {
            "Release signing requires KEYSTORE_PATH, KEYSTORE_PASSWORD, KEY_ALIAS and KEY_PASSWORD."
        }
    }
}
tasks.matching { it.name in setOf("assembleRelease", "bundleRelease") }.configureEach {
    dependsOn("verifyReleaseSigning")
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core-ktx:1.13.1")
    testImplementation("junit:junit:4.13.2")
}
