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
}
