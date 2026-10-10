#import "ViewController.h"
#import <WebKit/WebKit.h>
#import "ZPSchemeHandler.h"

@interface ViewController ()
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
  [self.view addSubview:self.webView];

  NSURL *url = [NSURL URLWithString:@"zp://local/index.html"];
  [self.webView loadRequest:[NSURLRequest requestWithURL:url]];
}

// l'app est toujours en portrait, comme la PWA
- (BOOL)shouldAutorotate { return NO; }
- (UIInterfaceOrientationMask)supportedInterfaceOrientations { return UIInterfaceOrientationMaskPortrait; }

@end
