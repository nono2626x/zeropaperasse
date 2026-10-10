#import "ViewController.h"
#import <WebKit/WebKit.h>
#import "ZPSchemeHandler.h"

@interface ViewController () <WKUIDelegate>
@property (strong, nonatomic) WKWebView *webView;
@end

@implementation ViewController

- (void)viewDidLoad {
  [super viewDidLoad];

  WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
  [config setURLSchemeHandler:[[ZPSchemeHandler alloc] init] forURLScheme:@"zp"];

  self.webView = [[WKWebView alloc] initWithFrame:self.view.bounds configuration:config];
  self.webView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  self.webView.backgroundColor = [UIColor colorWithRed:0.980 green:0.968 blue:0.949 alpha:1];
  self.webView.scrollView.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
  self.webView.UIDelegate = self;
  [self.view addSubview:self.webView];

  NSURL *url = [NSURL URLWithString:@"zp://local/index.html"];
  [self.webView loadRequest:[NSURLRequest requestWithURL:url]];
}

/* ---- affichage natif des alertes / confirmations JS (WKWebView ne les
   affiche pas tout seul : sans ça, confirm() renvoie silencieusement NON) ---- */
- (void)webView:(WKWebView *)webView runJavaScriptAlertPanelWithMessage:(NSString *)message
    initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(void))completionHandler {
  UIAlertController *alerte = [UIAlertController alertControllerWithTitle:@"ZéroPaperasse"
      message:message preferredStyle:UIAlertControllerStyleAlert];
  [alerte addAction:[UIAlertAction actionWithTitle:@"OK" style:UIAlertActionStyleDefault
      handler:^(UIAlertAction *action) { completionHandler(); }]];
  [self presentViewController:alerte animated:YES completion:completionHandler];
}

- (void)webView:(WKWebView *)webView runJavaScriptConfirmPanelWithMessage:(NSString *)message
    initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(BOOL result))completionHandler {
  UIAlertController *alerte = [UIAlertController alertControllerWithTitle:@"ZéroPaperasse"
      message:message preferredStyle:UIAlertControllerStyleAlert];
  [alerte addAction:[UIAlertAction actionWithTitle:@"Annuler" style:UIAlertActionStyleCancel
      handler:^(UIAlertAction *action) { completionHandler(NO); }]];
  [alerte addAction:[UIAlertAction actionWithTitle:@"Confirmer" style:UIAlertActionStyleDefault
      handler:^(UIAlertAction *action) { completionHandler(YES); }]];
  [self presentViewController:alerte animated:YES completion:completionHandler];
}

- (void)webView:(WKWebView *)webView runJavaScriptTextInputPanelWithPrompt:(NSString *)prompt
    defaultText:(NSString *)defaultText initiatedByFrame:(WKFrameInfo *)frame
    completionHandler:(void (^)(NSString *result))completionHandler {
  UIAlertController *alerte = [UIAlertController alertControllerWithTitle:@"ZéroPaperasse"
      message:prompt preferredStyle:UIAlertControllerStyleAlert];
  [alerte addTextFieldWithConfigurationHandler:^(UITextField *champ) { champ.text = defaultText; }];
  [alerte addAction:[UIAlertAction actionWithTitle:@"Annuler" style:UIAlertActionStyleCancel
      handler:^(UIAlertAction *action) { completionHandler(nil); }]];
  [alerte addAction:[UIAlertAction actionWithTitle:@"OK" style:UIAlertActionStyleDefault
      handler:^(UIAlertAction *action) { completionHandler(alerte.textFields.firstObject.text); }]];
  [self presentViewController:alerte animated:YES completion:completionHandler];
}

/* l'app est toujours en portrait, comme la PWA */
- (BOOL)shouldAutorotate { return NO; }
- (UIInterfaceOrientationMask)supportedInterfaceOrientations { return UIInterfaceOrientationMaskPortrait; }

@end
