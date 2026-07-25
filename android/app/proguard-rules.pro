# Add project specific ProGuard rules here.
# Capacitor and its plugins are safe with default rules since this project
# ships with minifyEnabled false. If you enable minification later, keep:
-keep class com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin
