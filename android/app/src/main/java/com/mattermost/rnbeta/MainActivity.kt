package com.mattermost.rnbeta

import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import androidx.core.view.WindowCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.mattermost.hardware.keyboard.MattermostHardwareKeyboardImpl
import com.mattermost.rnutils.helpers.FoldableObserver
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory;
import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
    private var HWKeyboardConnected = false
    private val foldableObserver = FoldableObserver.getInstance(this)
    private var lastOrientation: Int = Configuration.ORIENTATION_UNDEFINED

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "Mattermost"

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        ReactActivityDelegateWrapper(this, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
                DefaultReactActivityDelegate(this, mainComponentName, DefaultNewArchitectureEntryPoint.fabricEnabled))


    override fun onCreate(savedInstanceState: Bundle?) {
        supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
        super.onCreate(savedInstanceState)

        setHWKeyboardConnected()
        lastOrientation = this.resources.configuration.orientation
        foldableObserver.onCreate()
        WindowCompat.setDecorFitsSystemWindows(window, Build.VERSION.SDK_INT < Build.VERSION_CODES.R)
    }

    /**
     * Sin esto, un enlace que llega con la app YA ABIERTA se pierde.
     *
     * Linking.getInitialURL() de React Native lee currentActivity.intent
     * (IntentModule.kt), y ese intent es el que la actividad guardo al crearse:
     * onNewIntent() lo reenvia al delegate pero NADIE llama a setIntent(), asi
     * que getIntent() sigue devolviendo el primer enlace para siempre.
     *
     * Con launchMode singleTask eso significa que el segundo enlace, y el
     * tercero, se canjean como si fueran el primero. Medido: se lanzo el token
     * emitido 16:04 y el servidor recibio el de las 15:45, contestando "este
     * enlace ya se uso" sobre un enlace recien creado. Por eso tras borrar los
     * datos o reinstalar funcionaba --proceso nuevo, el primer intent era el
     * bueno-- y por eso fallaba siempre despues.
     */
    override fun onNewIntent(intent: android.content.Intent) {
        setIntent(intent)
        super.onNewIntent(intent)
    }

    override fun onStart() {
        super.onStart()
        foldableObserver.onStart()
    }

    override fun onStop() {
        super.onStop()
        foldableObserver.onStop()
    }

    override fun onDestroy() {
        super.onDestroy()
        foldableObserver.onDestroy()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        val newOrientation = newConfig.orientation
        if (newOrientation != lastOrientation) {
            lastOrientation = newOrientation
            foldableObserver.handleWindowLayoutInfo()
        }
        if (newConfig.hardKeyboardHidden == Configuration.HARDKEYBOARDHIDDEN_NO) {
            HWKeyboardConnected = true
        } else if (newConfig.hardKeyboardHidden == Configuration.HARDKEYBOARDHIDDEN_YES) {
            HWKeyboardConnected = false
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (HWKeyboardConnected) {
            val ok = MattermostHardwareKeyboardImpl.dispatchKeyEvent(event)
            if (ok) {
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    private fun setHWKeyboardConnected() {
        HWKeyboardConnected = getResources().configuration.keyboard == Configuration.KEYBOARD_QWERTY
    }
}
