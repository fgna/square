package com.community.app

import org.junit.Assert.*
import org.junit.Test

class TrustedOriginTest {
    @Test fun acceptsHttpsBaseOnly() {
        assertTrue(TrustedOrigin.validBase("https://square.example"))
        assertTrue(TrustedOrigin.validBase("https://192.168.1.121:3443"))
        assertFalse(TrustedOrigin.validBase("http://square.example"))
        assertFalse(TrustedOrigin.validBase("https://square.example/path"))
        assertFalse(TrustedOrigin.validBase("https://user@square.example"))
    }

    @Test fun rejectsUntrustedOriginAndPort() {
        assertTrue(TrustedOrigin.matches("https://square.example", "https://square.example/dashboard"))
        assertFalse(TrustedOrigin.matches("https://square.example", "https://evil.example"))
        assertFalse(TrustedOrigin.matches("https://square.example", "https://square.example:444"))
        assertFalse(TrustedOrigin.matches("https://square.example", "https://square.example.evil.org"))
        assertFalse(TrustedOrigin.matches("https://square.example", "http://square.example"))
    }
    @Test fun rejectsUnsafeNavigationAndRedirectTargets() {
        val base = "https://square.example"
        listOf(
            "http://square.example/dashboard",
            "https://evil.example/dashboard",
            "https://square.example.evil.org/dashboard",
            "https://square.example:444/dashboard",
            "https://user@square.example/dashboard",
            "javascript:alert(1)",
            "data:text/html,malicious",
            "file:///sdcard/private",
            "content://malicious.provider/item",
            "intent://square.example/#Intent;scheme=https;end",
            "https://square.example@evil.example/dashboard",
            "https://square.example\\@evil.example/dashboard",
            "https://square.example:8443/dashboard"
        ).forEach { target ->
            assertFalse("Unexpectedly trusted: $target", TrustedOrigin.matches(base, target))
        }
    }

    @Test fun handlesExplicitDefaultPortAndRejectsMalformedBases() {
        assertTrue(TrustedOrigin.matches("https://square.example:443", "https://square.example/"))
        assertTrue(TrustedOrigin.matches("https://square.example", "https://square.example:443/dashboard"))
        assertTrue(TrustedOrigin.matches("https://192.168.1.121:3443", "https://192.168.1.121:3443/login"))
        listOf(
            "",
            "https://square.example/path",
            "https://square.example?next=evil",
            "https://square.example#fragment",
            "https://user@square.example",
            "https://square.example:0",
            "https://square.example:65536",
            "http://square.example",
            "javascript:alert(1)"
        ).forEach { raw ->
            assertFalse("Unexpectedly valid base: $raw", TrustedOrigin.validBase(raw))
        }
    }

}
