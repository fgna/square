package com.community.app

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.Base64

class WebFilesTest {
    private fun message(name: String, type: String, bytes: ByteArray) =
        """{"name":"$name","type":"$type","data":"data:$type;base64,${Base64.getEncoder().encodeToString(bytes)}"}"""

    @Test
    fun readsACsvReport() {
        val blob = WebFiles.parse(message("members.csv", "text/csv", "a;b\n1;2\n".toByteArray()))!!
        assertEquals("members.csv", blob.name)
        assertEquals("text/csv", blob.mimeType)
        assertArrayEquals("a;b\n1;2\n".toByteArray(), blob.bytes)
    }

    @Test
    fun refusesMalformedOrOversizedMessages() {
        assertNull(WebFiles.parse(null))
        assertNull(WebFiles.parse("not json"))
        assertNull(WebFiles.parse("""{"name":"x","type":"text/csv","data":"https://example.com/x.csv"}"""))
        assertNull(WebFiles.parse("""{"name":"x","type":"text/csv","data":"data:text/csv,plain"}"""))
        assertNull(WebFiles.parse(message("big.bin", "application/octet-stream", ByteArray(WebFiles.MAX_BYTES + 3))))
    }

    @Test
    fun keepsNamesAndTypesHarmless() {
        assertEquals("passwd", WebFiles.safeName("../../etc/passwd"))
        assertEquals("report.csv", WebFiles.safeName("..\\report.csv"))
        assertEquals("download", WebFiles.safeName("  "))
        assertEquals("download", WebFiles.safeName(".."))
        assertEquals("ab.csv", WebFiles.safeName("a\u0000b?.csv"))
        val blob = WebFiles.parse(message("x.ics", "text/calendar\"; evil", byteArrayOf(1)))
        assertNull(blob)
        assertEquals("text/calendar",
            WebFiles.parse("""{"name":"x.ics","type":"text/calendar;charset=utf-8","data":"data:x;base64,AQ=="}""")!!.mimeType)
        assertEquals("application/octet-stream",
            WebFiles.parse("""{"name":"x","type":"<b>","data":"data:x;base64,AQ=="}""")!!.mimeType)
    }
}
