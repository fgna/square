package com.community.app

import org.junit.Assert.*
import org.junit.Test

class LoadProblemTest {
    private val origin = "https://192.168.1.121:4543"

    @Test fun untrustedCaExplainsHowToInstallItOnDebugBuilds() {
        val text = LoadProblem.certificate(origin, 3, debugBuild = true)
        assertTrue(text.contains(origin))
        assertTrue(text.contains("does not trust"))
        assertTrue(text.contains("CA certificate"))
    }

    @Test fun untrustedCaOnReleaseBuildsDoesNotSuggestInstallingOne() {
        val text = LoadProblem.certificate(origin, 3, debugBuild = false)
        assertTrue(text.contains("publicly trusted"))
        assertFalse(text.contains("Install a certificate"))
    }

    @Test fun dateProblemsPointToTheClock() {
        listOf(0, 1, 4).forEach { code ->
            assertTrue(LoadProblem.certificate(origin, code, debugBuild = true).contains("date and time"))
        }
        assertTrue(LoadProblem.certificate(origin, 2, debugBuild = true).contains("does not belong"))
        assertTrue(LoadProblem.certificate(origin, 99, debugBuild = true).contains("was rejected"))
    }

    @Test fun networkProblemNamesTheServerAndTheCause() {
        val text = LoadProblem.network(origin, "net::ERR_CONNECTION_REFUSED")
        assertTrue(text.startsWith("$origin could not be reached (net::ERR_CONNECTION_REFUSED)."))
        assertTrue(LoadProblem.network(origin, " ").startsWith("$origin could not be reached."))
        assertTrue(LoadProblem.network(origin, null).contains("speaks HTTPS"))
    }
}
